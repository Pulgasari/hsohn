// bindings.js - Reactive DOM binding store and DOM update pipeline

import { evalInScope } from './evaluator.js';

const bindings = [];

export function addBinding(binding) {
  bindings.push(binding);
}

export function updateBindings(globalState) {
  bindings.forEach(binding => {
    const { node, type, expr, scope, attrName, propName } = binding;
    const newValue = evalInScope(expr, scope, globalState);

    if (type === 'text') {
      if (node.textContent !== String(newValue)) {
        node.textContent = newValue !== undefined ? newValue : '';
      }
    } else if (type === 'property') {
      if (node[propName] !== newValue) {
        node[propName] = newValue;
      }
    } else if (type === 'attribute') {
      if (typeof newValue === 'boolean') {
        if (newValue) node.setAttribute(attrName, '');
        else node.removeAttribute(attrName);
      } else {
        node.setAttribute(attrName, newValue);
      }
    } else if (type === 'loop') {
      renderLoop(binding, globalState);
    }
  });
}

export function renderLoop(binding, globalState) {
  const { placeholder, templateEl, expr } = binding;
  const data = evalInScope(expr, {}, globalState) || [];
  const parent = placeholder.parentNode;
  if (!parent) return;

  if (binding.renderedNodes) {
    binding.renderedNodes.forEach(n => n.remove());
  }
  binding.renderedNodes = [];

  if (!Array.isArray(data)) return;

  const fragment = document.createDocumentFragment();

  data.forEach((item, index) => {
    const context = { item, index, isFirst: index === 0, isLast: index === data.length - 1 };
    const clone = templateEl.content.cloneNode(true);
    const htmlContent = clone.firstElementChild ? clone.firstElementChild.outerHTML : '';
    
    const rendered = htmlContent.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
      return path === 'item' ? item : (path === 'index' ? index : evalInScope(path, context, globalState));
    });

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rendered;
    while (tempDiv.firstChild) {
      const child = tempDiv.firstChild;
      binding.renderedNodes.push(child);
      fragment.appendChild(child);
    }
  });

  parent.insertBefore(fragment, placeholder);
}
