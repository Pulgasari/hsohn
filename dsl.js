// dsl.js - hsohn DSL Core Engine
const hsohn = (function () {
  // English comments per user settings
  const NATIVE_TAGS = new Set([
    'a', 'b', 'body', 'button', 'div', 'em', 'footer', 'form', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'head', 'header', 'html', 'img', 'input', 'li', 'link',
    'meta', 'nav', 'ol', 'p', 'script', 'section', 'span', 'strong', 'style', 'table', 'td', 'tr', 'label', 'select', 'option', 'code'
  ]);

  const customTagRegistry = new Map();
  const bindings = []; // Stores reactive DOM bindings
  let globalState = {};

  // Reactive Proxy Factory
  function createState(initialState = {}) {
    const handler = {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        return (typeof value === 'object' && value !== null) ? new Proxy(value, handler) : value;
      },
      set(target, prop, value, receiver) {
        const result = Reflect.set(target, prop, value, receiver);
        updateBindings();
        return result;
      }
    };
    globalState = new Proxy(initialState, handler);
    return globalState;
  }

  function evalInScope(expr, scope = {}) {
    const combinedScope = { ...globalState, ...scope };
    const keys = Object.keys(combinedScope);
    const values = Object.values(combinedScope);
    try {
      return new Function(...keys, `return (${expr});`)(...values);
    } catch (err) {
      console.warn(`[hsohn] Failed to evaluate expression "${expr}":`, err);
      return '';
    }
  }

  function execInScope(code, scope = {}) {
    const combinedScope = { ...globalState, ...scope };
    const keys = Object.keys(combinedScope);
    const values = Object.values(combinedScope);
    try {
      new Function(...keys, `with(this) { ${code}; }`).call(globalState, ...values);
      updateBindings();
    } catch (err) {
      console.error(`[hsohn] Failed to execute code "${code}":`, err);
    }
  }

  function updateBindings() {
    bindings.forEach(binding => {
      const { node, type, expr, scope, attrName, propName } = binding;
      const newValue = evalInScope(expr, scope);

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
        renderLoop(binding);
      }
    });
  }

  function preParse(rawCode) {
    if (!rawCode) return '';

    // 1. Expand multi-attribute assignment: [id, name]="val"
    let clean = rawCode.replace(/\[\s*([a-zA-Z0-9_,\s-]+)\s*\]\s*=\s*(["'])(.*?)\2/g, (_, attrs, quote, val) => {
      return attrs.split(',').map(a => `${a.trim()}=${quote}${val}${quote}`).join(' ');
    });

    // 2. Expand self-closing custom tags: <card /> -> <card></card>
    const voidElements = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'track', 'wbr']);
    clean = clean.replace(/<([a-zA-Z0-9-]+)([^>]*?)\/>/g, (match, tag, attrs) => {
      if (voidElements.has(tag.toLowerCase())) return match;
      return `<${tag}${attrs}></${tag}>`;
    });

    return clean;
  }

  function processDefinitions(container) {
    container.querySelectorAll('def').forEach(defEl => {
      const shortTag = defEl.getAttribute('tag');
      const targetComponent = defEl.getAttribute('is');
      if (shortTag && targetComponent) {
        customTagRegistry.set(shortTag.toLowerCase(), targetComponent);
      }
      defEl.remove();
    });
  }

  function renderLoop(binding) {
    const { placeholder, templateEl, expr } = binding;
    const data = evalInScope(expr) || [];
    const parent = placeholder.parentNode;
    if (!parent) return;

    // Clear previous rendered loop items
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
        return path === 'item' ? item : (path === 'index' ? index : evalInScope(path, context));
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

  function processLoops(container) {
    container.querySelectorAll('each').forEach(eachEl => {
      const itemsExpr = eachEl.getAttribute('items') || eachEl.getAttribute('from');
      const templateEl = eachEl.querySelector('template');
      if (!templateEl) {
        eachEl.remove();
        return;
      }

      const placeholder = document.createComment('loop-anchor');
      eachEl.replaceWith(placeholder);

      const loopBinding = {
        type: 'loop',
        placeholder,
        templateEl,
        expr: itemsExpr,
        renderedNodes: []
      };

      bindings.push(loopBinding);
    });
  }

  function processElement(element, currentScope = '') {
    let activeScope = currentScope;

    Array.from(element.attributes).forEach(attr => {
      const name = attr.name;
      const value = attr.value;

      // 1. Two-Way Data Binding (bind:value / bind:checked)
      if (name.startsWith('bind:')) {
        const prop = name.slice(5);
        const stateKey = value.trim();

        // State -> DOM
        bindings.push({
          node: element,
          type: 'property',
          propName: prop,
          expr: stateKey
        });

        // DOM -> State
        const eventType = (element.type === 'checkbox' || element.type === 'radio' || element.tagName === 'SELECT') ? 'change' : 'input';
        element.addEventListener(eventType, (e) => {
          const newVal = (prop === 'checked') ? e.target.checked : e.target.value;
          execInScope(`${stateKey} = $val`, { $val: newVal });
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

            execInScope(value, { $event: e });
          };

          element.addEventListener(eventName, eventHandler);
          element.removeAttribute(name);
        }
      }
      // 3. Dynamic Attribute Binding (:disabled="cond")
      else if (name.startsWith(':')) {
        const realAttrName = name.slice(1);
        bindings.push({
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
            bindings.push({
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

    Array.from(targetNode.children).forEach(child => processElement(child, activeScope));
  }

  function compileSource(rawContent, targetEl) {
    const preparsedHTML = preParse(rawContent);
    const container = document.createElement('div');
    container.innerHTML = preparsedHTML;

    processDefinitions(container);
    processLoops(container);
    Array.from(container.children).forEach(child => processElement(child));

    const fragment = document.createDocumentFragment();
    while (container.firstChild) {
      fragment.appendChild(container.firstChild);
    }
    targetEl.replaceWith(fragment);

    updateBindings();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const scriptEl = document.querySelector('script[type="text/hsohn"]');
    if (scriptEl) {
      compileSource(scriptEl.textContent, scriptEl);
      return;
    }

    const dslEl = document.querySelector('dsl');
    if (dslEl) {
      dslEl.style.display = 'none';
      compileSource(dslEl.innerHTML, dslEl);
    }
  });

  return { state: createState };
})();
