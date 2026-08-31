// reactive.js - Reactive state proxy management

export function createReactiveState(initialState = {}, onChange = () => {}) {
  const handler = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      return (typeof value === 'object' && value !== null) ? new Proxy(value, handler) : value;
    },
    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      onChange();
      return result;
    }
  };
  return new Proxy(initialState, handler);
}
