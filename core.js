// dsl.js - Self-executing DSL compiler for <head>
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

  function resolveData(itemsAttr, doc) {
    if (!itemsAttr) return [];

    // 1. Resolve from global window context
    const globalVar = getNestedValue(window, itemsAttr);
    if (globalVar !== undefined && globalVar !== '') return globalVar;

    // 2. Resolve from <data> element (supports #id attribute or standard id)
    if (itemsAttr.startsWith('#')) {
      const idName = itemsAttr.slice(1);
      const dataEl = doc.querySelector(itemsAttr) || 
                     doc.querySelector(`[\\#${CSS.escape(idName)}]`) ||
                     document.querySelector(itemsAttr) ||
                     document.querySelector(`[\\#${CSS.escape(idName)}]`);
                     
      if (dataEl) return parseJSON5(dataEl.textContent);
    }

    // 3. Resolve inline JSON5 array
    return parseJSON5(itemsAttr) || [];
  }

  function processLoops(doc) {
    const eachElements = Array.from(doc.querySelectorAll('each'));

    eachElements.forEach(eachEl => {
      const itemsAttr = eachEl.getAttribute('items') || eachEl.getAttribute('from');
      const data = resolveData(itemsAttr, doc);
      const templateEl = eachEl.querySelector('template');

      if (!templateEl || !Array.isArray(data)) {
        eachEl.remove();
        return;
      }

      const templateHTML = templateEl.innerHTML;
      const fragment = doc.createDocumentFragment();

      data.forEach((item, index) => {
        const context = {
          item,
          index,
          isFirst: index === 0,
          isLast: index === data.length - 1
        };

        const renderedString = templateHTML.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
          const val = getNestedValue(context, path);
          return val !== undefined ? val : '';
        });

        const tempDiv = doc.createElement('div');
        tempDiv.innerHTML = renderedString;

        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
      });

      eachEl.replaceWith(fragment);
    });

    // Remove <data> blocks so they do not remain in the final DOM
    doc.querySelectorAll('data').forEach(el => el.remove());
  }

  function processElement(element, doc, currentScope = '') {
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

    if (!NATIVE_TAGS.has(tagName) && !tagName.includes('-') && tagName !== 'body' && tagName !== 'html') {
      const div = doc.createElement('div');
      const existingClass = element.getAttribute('class') || '';

      div.className = existingClass ? `${tagName} ${existingClass}` : tagName;

      Array.from(element.attributes).forEach(a => div.setAttribute(a.name, a.value));
      while (element.firstChild) div.appendChild(element.firstChild);

      element.replaceWith(div);
      targetNode = div;
    }

    Array.from(targetNode.children).forEach(child => processElement(child, doc, activeScope));
  }

  function compileScriptTag(scriptEl) {
    const rawMarkup = scriptEl.textContent;
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawMarkup, 'text/html');

    // 1. Unroll loops & process <data> tags
    processLoops(doc);

    // 2. Transform custom tags and IDs
    Array.from(doc.body.children).forEach(child => processElement(child, doc));

    // 3. Render into DOM
    const targetSelector = scriptEl.getAttribute('target');
    const renderedHTML = doc.body.innerHTML;

    if (targetSelector) {
      const target = document.querySelector(targetSelector);
      if (target) target.innerHTML = renderedHTML;
    } else {
      const template = document.createElement('template');
      template.innerHTML = renderedHTML;
      scriptEl.replaceWith(template.content);
    }
  }

  // Auto-run when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const scripts = Array.from(document.querySelectorAll('script[type="text/custom-html"]'));
    scripts.forEach(compileScriptTag);
  });
})();
