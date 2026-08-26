const $  = (selector) => document.querySelector(selector); 
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

// Relaxed JSON / JSON5 parser using Function execution (works for unquoted keys, single quotes, etc.)
function parseJSON5(rawString) {
  if (!rawString) return null;
  try {
    return (new Function(`return (${rawString});`))();
  } catch (err) {
    console.error('Failed to parse JSON5 data:', err);
    return null;
  }
}

// Helper to resolve nested object paths (e.g. "item.user.name")
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : ''), obj);
}

// Unroll <each> elements before tag transformation
function processLoops(doc) {
  const eachElements = Array.from(doc.querySelectorAll('each'));

  eachElements.forEach(eachEl => {
    const itemsAttr = eachEl.getAttribute('items') || eachEl.getAttribute('from');
    let data = [];

    if (itemsAttr) {
      if (itemsAttr.startsWith('#')) {
        // Fetch data from an external script tag (e.g. <script type="application/json5" id="data">)
        const scriptEl = doc.querySelector(itemsAttr) || document.querySelector(itemsAttr);
        if (scriptEl) {
          data = parseJSON5(scriptEl.textContent);
        }
      } else {
        // Inline JSON5 array in items attribute
        data = parseJSON5(itemsAttr);
      }
    }

    const templateEl = eachEl.querySelector('template');
    if (!templateEl || !Array.isArray(data)) {
      eachEl.remove();
      return;
    }

    const templateHTML = templateEl.innerHTML;
    const fragment = doc.createDocumentFragment();

    data.forEach((item, index) => {
      // Create template context
      const context = {
        item,
        index,
        isFirst: index === 0,
        isLast: index === data.length - 1
      };

      // Substitute {{path}} interpolations
      const renderedString = templateHTML.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
        const val = getNestedValue(context, path);
        return val !== undefined ? val : '';
      });

      // Parse substituted markup into temporary container
      const tempDiv = doc.createElement('div');
      tempDiv.innerHTML = renderedString;

      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }
    });

    // Replace <each> node with the generated fragment
    eachEl.replaceWith(fragment);
  });
}

export function compile (targetSelector = '#app') {
  const files = $$('script[type="text/custom-html"]').map(processOne);
  const target = $(targetSelector);
  if (target) {
    target.innerHTML = files.join('');
  }
}

export function compile2 (targetSelector = '#app') {
  const target = $(targetSelector);   if (target) {     target.innerHTML = $$('script[type="text/custom-html"]').map(processOne).join('');
  }
}

function processOne (element) {
  const rawMarkup = element.textContent;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawMarkup, 'text/html');

  // Step 1: Unroll <each> loops and interpolate template variables
  processLoops(doc);

  const NATIVE_TAGS = new Set([
    'a', 'b', 'body', 'button', 'div', 'em', 'footer', 'form', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'head', 'header', 'html', 'img', 'input', 'li', 'link',
    'meta', 'nav', 'ol', 'p', 'script', 'section', 'span', 'strong', 'style', 'table', 'td', 'tr'
  ]);

  function processElement(element, currentScope = '') {
    let activeScope = currentScope;

    // Process short-form ID attributes
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('#-')) {
        const subId = attr.name.slice(2);
        element.setAttribute('id', currentScope ? `${currentScope}-${subId}` : subId);
        element.removeAttribute(attr.name);
      } else if (attr.name.startsWith('#')) {
        // Support dynamic scope syntax like #="{{item.id}}" -> parsed to #pinch
        const value = attr.value || attr.name.slice(1);
        activeScope = value;
        element.setAttribute('id', activeScope);
        element.removeAttribute(attr.name);
      }
    });

    // Convert non-native custom tags to <div class="tagname">
    const tagName = element.tagName.toLowerCase();
    let targetNode = element;

    if (!NATIVE_TAGS.has(tagName) && !tagName.includes('-') && tagName !== 'body' && tagName !== 'html') {
      const div = doc.createElement('div');
      const existingClass = element.getAttribute('class') || '';

      // Preserve space between custom tag class and existing classes
      div.className = existingClass ? `${tagName} ${existingClass}` : tagName;

      // Copy remaining attributes and children
      Array.from(element.attributes).forEach(a => div.setAttribute(a.name, a.value));
      while (element.firstChild) div.appendChild(element.firstChild);

      element.replaceWith(div);
      targetNode = div;
    }

    // Recursively walk through child nodes
    Array.from(targetNode.children).forEach(child => processElement(child, activeScope));
  }

  // Step 2: Transform custom tags and IDs
  Array.from(doc.body.children).forEach(child => processElement(child));

  return doc.body.innerHTML ?? '';
}
