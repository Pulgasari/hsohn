// compiler.js - DOM parsing, tag resolution, and attribute compilation

import { preParse } from './preparser.js';
import { execInScope } from './evaluator.js';
import { addBinding, updateBindings } from './bindings.js';

const NATIVE_TAGS = new Set([
  'a', 'b', 'body', 'button', 'div', 'em', 'footer', 'form', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'head', 'header', 'html', 'img', 'input', 'li', 'link',
  'meta', 'nav', 'ol', 'p', 'script', 'section', 'span', 'strong', 'style', 'table', 'td', 'tr', 'label', 'select', 'option', 'code'
]);

const customTagRegistry = new Map();

export function processDefinitions(container) {
  container.querySelectorAll('def').forEach(defEl => {
    const shortTag = defEl.getAttribute('tag');
    const targetComponent = defEl.getAttribute('is');
    if (shortTag && targetComponent) {
      customTagRegistry.set(shortTag.toLowerCase(), targetComponent);
    }
    defEl.remove();
  });
}

export function processLoops(container) {
  container.querySelectorAll('each').forEach(eachEl => {
    const itemsExpr = eachEl.getAttribute('items') || eachEl.getAttribute('from');
    const templateEl = eachEl.querySelector('template');
    if (!templateEl) {
      eachEl.remove();
      return;
    }

    const placeholder = document.createComment('loop-anchor');
    eachEl.replaceWith(placeholder);

    addBinding({
      type: 'loop',
      placeholder,
      templateEl,
      expr: itemsExpr,
      renderedNodes: []
    });
  });
}

export function processElement(element, getGlobalState, triggerUpdate, currentScope = '') {
  let activeScope = currentScope;

  Array.from(element.attributes).forEach(attr => {
    const name = attr.name;
    const value = attr.value;

    // 1. Two-Way Data Binding (bind:value / bind:checked)
    if (name.startsWith('bind:')) {
      const prop = name.slice(5);
      const stateKey = value.trim();

      addBinding({
        node: element,
        type: 'property',
        propName: prop,
        expr: stateKey
      });

      const eventType = (element.type === 'checkbox' || element.type === 'radio' || element.tagName === 'SELECT') ? 'change' : 'input';
      element.addEventListener(eventType, (e) => {
        const newVal = (prop === 'checked') ? e.target.checked : e.target.value;
        execInScope(`${stateKey} = $val`, { $val: newVal }, getGlobalState(), triggerUpdate);
      });

      element.removeAttribute(name);
    }
    // 2. Event Matcher: on:, on!:, once:, once!: with optional modifiers
    else if (/^(on|once)(!?):/.test(name)) {
      const eventMatch = name.match(/^(on|once)(!?):([^|]+)(?:\|(.*))?$/);
      if (eventMatch) {
        const [, prefix, exclamation, eventName, rawMods] = eventMatch;
        const mods = rawMods ? rawMods.split('|') : [];

        const isOnce = prefix === 'once' || mods.includes('once');
        const shouldPreventDefault = exclamation === '!' || mods.includes('preventDefault');

        const eventHandler = function (e) {
          if (mods.includes('enter') && e.key !== 'Enter') return;
          if (mods.includes('escape') && e.key !== 'Escape') return;

          if (shouldPreventDefault) e.preventDefault();
          if (mods.includes('stopPropagation')) e.stopPropagation();

          if (isOnce) {
            element.removeEventListener(eventName, eventHandler);
          }

          execInScope(value, { $event: e }, getGlobalState(), triggerUpdate);
        };

        element.addEventListener(eventName, eventHandler);
        element.removeAttribute(name);
      }
    }
    // 3. Dynamic Attribute Binding (:disabled="cond")
    else if (name.startsWith(':')) {
      const realAttrName = name.slice(1);
      addBinding({
        node: element,
        type: 'attribute',
        attrName: realAttrName,
        expr: value
      });
      element.removeAttribute(name);
    }
    // 4. ID Scoping (# and #-)
    else if (name.startsWith('#-')) {
      const subId = name.slice(2);
      element.setAttribute('id', currentScope ? `${currentScope}-${subId}` : subId);
      element.removeAttribute(name);
    } else if (name.startsWith('#')) {
      activeScope = value || name.slice(1);
      element.setAttribute('id', activeScope);
      element.removeAttribute(name);
    }
  });

  // Text Interpolation {{ expr }}
  Array.from(element.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('{{')) {
      const rawText = node.textContent;
      const parts = rawText.split(/(\{\{\s*.*?\s*\}\})/g);

      const fragment = document.createDocumentFragment();
      parts.forEach(part => {
        if (part.startsWith('{{') && part.endsWith('}}')) {
          const expr = part.slice(2, -2).trim();
          const textNode = document.createTextNode('');
          addBinding({
            node: textNode,
            type: 'text',
            expr: expr
          });
          fragment.appendChild(textNode);
        } else if (part) {
          fragment.appendChild(document.createTextNode(part));
        }
      });
      node.replaceWith(fragment);
    }
  });

  const tagName = element.tagName.toLowerCase();
  let targetNode = element;

  // Custom Tag Transformation
  if (!NATIVE_TAGS.has(tagName) && !tagName.includes('-') && !['body', 'html', 'dsl'].includes(tagName)) {
    let targetTagName = 'div';
    let defaultClass = tagName;

    if (customTagRegistry.has(tagName)) {
      targetTagName = customTagRegistry.get(tagName);
      defaultClass = '';
    }

    const newEl = document.createElement(targetTagName);
    const existingClass = element.getAttribute('class') || '';

    if (defaultClass) {
      newEl.className = existingClass ? `${defaultClass} ${existingClass}` : defaultClass;
    } else if (existingClass) {
      newEl.className = existingClass;
    }

    Array.from(element.attributes).forEach(a => newEl.setAttribute(a.name, a.value));
    while (element.firstChild) newEl.appendChild(element.firstChild);

    element.replaceWith(newEl);
    targetNode = newEl;
  }

  Array.from(targetNode.children).forEach(child => processElement(child, getGlobalState, triggerUpdate, activeScope));
}

export function compileSource(rawContent, targetEl, getGlobalState, triggerUpdate) {
  const preparsedHTML = preParse(rawContent);
  const container = document.createElement('div');
  container.innerHTML = preparsedHTML;

  processDefinitions(container);
  processLoops(container);
  Array.from(container.children).forEach(child => processElement(child, getGlobalState, triggerUpdate));

  const fragment = document.createDocumentFragment();
  while (container.firstChild) {
    fragment.appendChild(container.firstChild);
  }
  targetEl.replaceWith(fragment);

  updateBindings(getGlobalState());
}
