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
