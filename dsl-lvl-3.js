(function () {
  // English comments per user settings
  const NATIVE_TAGS = new Set([
    'a', 'b', 'body', 'button', 'div', 'em', 'footer', 'form', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'head', 'header', 'html', 'img', 'input', 'li', 'link',
    'meta', 'nav', 'ol', 'p', 'script', 'section', 'span', 'strong', 'style', 'table', 'td', 'tr'
  ]);

  // Registry for mapping custom short tags to actual Web Components
  const customTagRegistry = new Map();

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

  // Pre-parser working on raw code strings before HTML DOM parsing
  function preParse(rawCode) {
    if (!rawCode) return '';

    // 1. Expand multi-attribute assignment: [id, name]="val" -> id="val" name="val"
    let clean = rawCode.replace(/\[\s*([a-zA-Z0-9_,\s-]+)\s*\]\s*=\s*(["'])(.*?)\2/g, (_, attrs, quote, val) => {
      return attrs.split(',').map(a => `${a.trim()}=${quote}${val}${quote}`).join(' ');
    });

    // 2. Expand self-closing custom tags: <card /> -> <card></card>
    const voidElements = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'track', 'wbr', 'area', 'base', 'col', 'embed', 'param']);
    clean = clean.replace(/<([a-zA-Z0-9-]+)([^>]*?)\/>/g, (match, tag, attrs) => {
      if (voidElements.has(tag.toLowerCase())) return match;
      return `<${tag}${attrs}></${tag}>`;
    });

    return clean;
  }

  // Process <def tag="xy" is="web-component" /> declarations
  function processDefinitions(container) {
    const defElements = Array.from(container.querySelectorAll('def'));
    defElements.forEach(defEl => {
      const shortTag = defEl.getAttribute('tag');
      const targetComponent = defEl.getAttribute('is');
      if (shortTag && targetComponent) {
        customTagRegistry.set(shortTag.toLowerCase(), targetComponent);
      }
      defEl.remove();
    });
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

    // Process # and #- attribute shorthands for IDs
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

    // Replace custom tags with div.className OR registered Web Component
    if (!NATIVE_TAGS.has(tagName) && !tagName.includes('-') && !['body', 'html', 'dsl'].includes(tagName)) {
      let targetTagName = 'div';
      let defaultClass = tagName;

      // Check if tag is mapped to a Web Component
      if (customTagRegistry.has(tagName)) {
        targetTagName = customTagRegistry.get(tagName);
        defaultClass = ''; // Web Component manages its own styling
      }

      const newEl = document.createElement(targetTagName);
      const existingClass = element.getAttribute('class') || '';

      if (defaultClass) {
        newEl.className = existingClass ? `${defaultClass}${existingClass}` : defaultClass;
      } else if (existingClass) {
        newEl.className = existingClass;
      }

      // Copy attributes
      Array.from(element.attributes).forEach(a => newEl.setAttribute(a.name, a.value));

      // Transfer child nodes
      while (element.firstChild) newEl.appendChild(element.firstChild);

      element.replaceWith(newEl);
      targetNode = newEl;
    }

    // Recursively process child elements with updated activeScope
    Array.from(targetNode.children).forEach(child => processElement(child, activeScope));
  }

  function compileSource(rawContent, targetEl) {
    // Step 1: Pre-parse string (multi-attributes, self-closing tags)
    const preparsedHTML = preParse(rawContent);

    // Step 2: Parse string into temporary DOM container
    const container = document.createElement('div');
    container.innerHTML = preparsedHTML;

    // Step 3: Extract & register <def> tag mappings
    processDefinitions(container);

    // Step 4: Expand loops
    processLoops(container);

    // Step 5: Process element transformation (#, #-, custom tags, web components)
    Array.from(container.children).forEach(child => processElement(child));

    // Step 6: Inject back into document
    const fragment = document.createDocumentFragment();
    while (container.firstChild) {
      fragment.appendChild(container.firstChild);
    }
    targetEl.replaceWith(fragment);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Try reading from <script type="text/hsohn"> (Recommended to avoid raw HTML mangling)
    const scriptEl = document.querySelector('script[type="text/hsohn"]');
    if (scriptEl) {
      compileSource(scriptEl.textContent, scriptEl);
      return;
    }

    // 2. Fallback: Try reading from <dsl> tag
    const dslEl = document.querySelector('dsl');
    if (dslEl) {
      dslEl.style.display = 'none';
      compileSource(dslEl.innerHTML, dslEl);
    }
  });
})();
