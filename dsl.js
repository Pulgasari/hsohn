(function () {

// document.body.style.display = 'none';
  
  // English comments per user settings
  const NATIVE_TAGS = new Set([
    'a', 'b', 'body', 'button', 'div', 'em', 'footer', 'form', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'head', 'header', 'html', 'img', 'input', 'li', 'link',
    'meta', 'nav', 'ol', 'p', 'script', 'section', 'span', 'strong', 'style', 'table', 'td', 'tr'
  ]);

  // Safely parse JSON strings without eval or new Function
  function safeJSONParse(rawString) {
    if (!rawString) return null;
    try {
      return JSON.parse(rawString);
    } catch (err) {
      console.warn('[hsohn] Fallback parsing failed for string:', rawString);
      return null;
    }
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : ''), obj);
  }

  function processLoops(container) {
    const eachElements = Array.from(container.querySelectorAll('each'));

    eachElements.forEach(eachEl => {
      const itemsAttr = eachEl.getAttribute('items') || eachEl.getAttribute('from');
      let data = [];

      if (itemsAttr && itemsAttr.startsWith('#')) {
        const dataEl = container.querySelector(itemsAttr);
        if (dataEl) data = safeJSONParse(dataEl.textContent) || [];
      } else {
        data = safeJSONParse(itemsAttr) || [];
      }

      const templateEl = eachEl.querySelector('template');
      if (!templateEl || !Array.isArray(data)) {
        eachEl.remove();
        return;
      }

      const fragment = document.createDocumentFragment();

      data.forEach((item, index) => {
        const context = { item, index, isFirst: index === 0, isLast: index === data.length - 1 };
        const clone = templateEl.content.cloneNode(true);
        
        // Traverse and bind scope data safely
        const htmlContent = clone.firstElementChild ? clone.firstElementChild.outerHTML : '';
        const rendered = htmlContent.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
          return getNestedValue(context, path);
        });

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = rendered;
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
      });

      eachEl.replaceWith(fragment);
    });
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

    if (!NATIVE_TAGS.has(tagName) && !tagName.includes('-') && !['body', 'html', 'dsl'].includes(tagName)) {
      const div = document.createElement('div');
      const existingClass = element.getAttribute('class') || '';

      div.className = existingClass ? `${tagName}${existingClass}` : tagName;

      Array.from(element.attributes).forEach(a => div.setAttribute(a.name, a.value));
      while (element.firstChild) div.appendChild(element.firstChild);

      element.replaceWith(div);
      targetNode = div;
    }

    Array.from(targetNode.children).forEach(child => processElement(child, activeScope));
  }

  function compileDslElement(dslEl) {
    // Hide container to prevent layout flash during compilation
    dslEl.style.display = 'none';

    processLoops(dslEl);
    Array.from(dslEl.children).forEach(child => processElement(child));

    const fragment = document.createDocumentFragment();
    while (dslEl.firstChild) {
      fragment.appendChild(dslEl.firstChild);
    }
    dslEl.replaceWith(fragment);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const dslEl = document.querySelector('dsl');
    if (dslEl) compileDslElement(dslEl);
  });
})();
