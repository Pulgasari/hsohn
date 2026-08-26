function parseCustomHTML(inputString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<root>${inputString}</root>`, 'text/xml');
  
  const NATIVE_TAGS = new Set(['h1','h2','h3','h4','h5','h6','div','span','strong','em','p','a','button']);

  function walk(element, scope = '') {
    let currentScope = scope;

    // Resolve # attributes
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('#-')) {
        element.setAttribute('id', scope ? `${scope}-${attr.name.slice(2)}` : attr.name.slice(2));
        element.removeAttribute(attr.name);
      } else if (attr.name.startsWith('#')) {
        currentScope = attr.name.slice(1);
        element.setAttribute('id', currentScope);
        element.removeAttribute(attr.name);
      }
    });

    // Replace custom tag with div + class
    const tagName = element.tagName.toLowerCase();
    let targetEl = element;

    if (!NATIVE_TAGS.has(tagName) && !tagName.includes('-') && tagName !== 'root') {
      const div = doc.createElement('div');
      div.className = tagName;
      
      // Copy remaining attributes and child nodes
      Array.from(element.attributes).forEach(a => div.setAttribute(a.name, a.value));
      while (element.firstChild) div.appendChild(element.firstChild);
      
      element.replaceWith(div);
      targetEl = div;
    }

    // Traverse children
    Array.from(targetEl.children).forEach(child => walk(child, currentScope));
  }

  walk(doc.documentElement);
  return doc.documentElement.innerHTML;
}

const $  = document.querySelector;
const $$ = document.querySelectorAll;

export function compile (targetSelector = '#app') {
  const files = document.querySelectorAll('script[type="text/custom-html"]').map(processOne);
  files.forEach( file => document.querySelector(targetSelector).innerHTML = file );
}

export function compile2 (targetSelector = '#app') {
  $(targetSelector).innerHTML = $$('script[type="text/custom-html"]').map(processOne).join('');    
}

    function processOne (element) {
      const rawMarkup = element.textContent;
      
      // Parse using text/html to tolerate standard HTML syntax and entities
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawMarkup, 'text/html');

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
            activeScope = attr.name.slice(1);
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
          div.className = existingClass ? `${tagName}${existingClass}` : tagName;

          // Copy remaining attributes and children
          Array.from(element.attributes).forEach(a => div.setAttribute(a.name, a.value));
          while (element.firstChild) div.appendChild(element.firstChild);

          element.replaceWith(div);
          targetNode = div;
        }

        // Recursively walk through child nodes
        Array.from(targetNode.children).forEach(child => processElement(child, activeScope));
      }

      // Transform all elements inside body
      Array.from(doc.body.children).forEach(child => processElement(child));

      // Inject rendered result into target container
      return doc.body.innerHTML ?? '';
    }
