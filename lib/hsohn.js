// hsohn.js - Entry point and public API export

import { createReactiveState } from './reactive.js';
import { updateBindings } from './bindings.js';
import { compileSource } from './compiler.js';

let globalState = {};

export function state(initialState = {}) {
  globalState = createReactiveState(initialState, () => {
    updateBindings(globalState);
  });
  return globalState;
}

export function getGlobalState() {
  return globalState;
}

export function triggerUpdate() {
  updateBindings(globalState);
}

document.addEventListener('DOMContentLoaded', () => {
  const scriptEl = document.querySelector('script[type="text/hsohn"]');
  if (scriptEl) {
    compileSource(scriptEl.textContent, scriptEl, getGlobalState, triggerUpdate);
    return;
  }

  const dslEl = document.querySelector('dsl');
  if (dslEl) {
    dslEl.style.display = 'none';
    compileSource(dslEl.innerHTML, dslEl, getGlobalState, triggerUpdate);
  }
});
