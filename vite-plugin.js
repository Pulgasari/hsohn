// vite-plugin-custom-html.js
import { parse } from 'node-html-parser';

const NATIVE_TAGS = new Set([
  'a', 'b', 'body', 'button', 'div', 'em', 'footer', 'form', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'head', 'header', 'html', 'img', 'input', 'li', 'link',
  'meta', 'nav', 'ol', 'p', 'script', 'section', 'span', 'strong', 'style', 'table', 'td', 'tr'
]);

function transformNode(node, currentScope = '') {
  if (node.nodeType !== 1) return; // Skip non-element nodes

  const rawTag = node.rawTagName;
  let newScope = currentScope;

  // Process short-form ID attributes (#foo and #-bar)
  const attrs = Object.keys(node.attributes);
  for (const attr of attrs) {
    if (attr.startsWith('#-')) {
      const subId = attr.slice(2);
      node.setAttribute('id', currentScope ? `${currentScope}-${subId}` : subId);
      node.removeAttribute(attr);
    } else if (attr.startsWith('#')) {
      const idVal = attr.slice(1);
      newScope = idVal;
      // Assign ID if tag explicitly uses #id or keep as scope context
      if (!attr.startsWith('#-')) node.setAttribute('id', idVal);
      node.removeAttribute(attr);
    }
  }

  // Convert custom tags (non-native, no hyphens) to <div class="tagname">
  if (rawTag && !NATIVE_TAGS.has(rawTag) && !rawTag.includes('-')) {
    node.tagName = 'div';
    const existingClass = node.getAttribute('class') || '';
    node.setAttribute('class', existingClass ? `${rawTag} ${existingClass}` : rawTag);
  }

  // Recursively transform child elements with active scope
  for (const child of node.childNodes) {
    transformNode(child, newScope);
  }
}

export default function customHtmlPlugin() {
  return {
    name: 'vite-plugin-custom-html',
    transformIndexHtml(html) {
      const root = parse(html);
      transformNode(root);
      return root.toString();
    }
  };
}
