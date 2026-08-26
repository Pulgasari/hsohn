// dsl.js - Synchronous blocking compiler
(function () {
  const NATIVE_TAGS = new Set([
    'a', 'b', 'body', 'button', 'div', 'em', 'footer', 'form', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'head', 'header', 'html', 'img', 'input', 'li', 'link',
    'meta', 'nav', 'ol', 'p', 'script', 'section', 'span', 'strong', 'style', 'table', 'td', 'tr'
  ]);

  function parseJSON5(rawString) {
    if (!rawString) return null;
    try {
      return (new Function(`return (${rawString});`))();
    } catch (err) {
      console.error('Failed to parse JSON5 data:', err);
      return null;
    }
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : ''), obj);
  }

  function resolveData(itemsAttr, scopeEl) {
    if (!itemsAttr) return [];

    if (itemsAttr.startsWith('#')) {
      const idName = itemsAttr.slice(1);
      const dataEl = scopeEl.querySelector(itemsAttr) || 
                     scopeEl.querySelector(`[\\#${CSS.escape(idName)}]`);
                     
      if (dataEl) return parseJSON5(dataEl.textContent);
    }

    return parseJSON5(itemsAttr) || [];
  }

  function processLoops(container) {
    const eachElements = Array.from(container.querySelectorAll('each'));

    eachElements.forEach(eachEl => {
      const itemsAttr = eachEl.getAttribute('items') || eachEl.getAttribute('from');
      const data = resolveData(itemsAttr, container);
      const templateEl = eachEl.querySelector('template');

      if (!templateEl || !Array.isArray(data)) {
        eachEl.remove();
        return;
      }

      const templateHTML = templateEl.innerHTML;
      const fragment = document.createDocumentFragment();

      data.forEach((item, index) => {
        const context = { item, index, isFirst: index === 0, isLast: index === data.length - 1 };
        const renderedString = templateHTML.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
          const val = getNestedValue(context, path);
          return val !== undefined ? val : '';
        });

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderedString;

        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
      });

      eachEl.replaceWith(fragment);
    });

    container.querySelectorAll('data').forEach(el => el.remove());
  }

  function processElement(element, currentScope = '') {
    let activeScope = currentScope;

    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('#-')) {
        const subId = attr.name.slice(2);
        element.setAttribute('id', currentScope ? `${currentScope}-${subId}` : subId);
        element.removeAttribute(attr.name);
      } else if (attr.name.startsWith('#')) {
        const value = attr.value || attr.name.slice(1);
        activeScope = value;
        element.setAttribute('id', activeScope);
        element.removeAttribute(attr.name);
      }
    });

    const tagName = element.tagName.toLowerCase();
    let targetNode = element;

    if (!NATIVE_TAGS.has(tagName) && !tagName.includes('-') && tagName !== 'body' && tagName !== 'html' && tagName !== 'dsl') {
      const div = document.createElement('div');
      const existingClass = element.getAttribute('class') || '';

      div.className = existingClass ? `${tagName} ${existingClass}` : tagName;

      Array.from(element.attributes).forEach(a => div.setAttribute(a.name, a.value));
      while (element.firstChild) div.appendChild(element.firstChild);

      element.replaceWith(div);
      targetNode = div;
    }

    Array.from(targetNode.children).forEach(child => processElement(child, activeScope));
  }

  function compileDslElement(dslEl) {
    if (dslEl.hasAttribute('title')) document.title = dslEl.getAttribute('title');
    if (dslEl.hasAttribute('lang')) document.documentElement.lang = dslEl.getAttribute('lang');

    processLoops(dslEl);
    Array.from(dslEl.children).forEach(child => processElement(child));

    const fragment = document.createDocumentFragment();
    while (dslEl.firstChild) {
      fragment.appendChild(dslEl.firstChild);
    }
    dslEl.replaceWith(fragment);
  }

  // Execute immediately on current DOM state
  const dslEl = document.querySelector('dsl');
  if (dslEl) {
    compileDslElement(dslEl);
  }
})();
