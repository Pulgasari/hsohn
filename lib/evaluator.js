// evaluator.js - Expression evaluation and statement execution in scope

export function evalInScope(expr, scope = {}, globalState = {}) {
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

export function execInScope(code, scope = {}, globalState = {}, onMutation = () => {}) {
  const combinedScope = { ...globalState, ...scope };
  const keys = Object.keys(combinedScope);
  const values = Object.values(combinedScope);
  try {
    new Function(...keys, `with(this) { ${code}; }`).call(globalState, ...values);
    onMutation();
  } catch (err) {
    console.error(`[hsohn] Failed to execute code "${code}":`, err);
  }
}
