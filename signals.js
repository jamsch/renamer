// @ts-check

/**
 * @type {Array<Function>}
 */
const effects = [];

/**
 * @type {Set<Function>}
 */
const pendingEffects = new Set();
let isFlushing = false;

/**
 * @param {Function} effect
 */
function scheduleEffect(effect) {
  pendingEffects.add(effect);
  if (!isFlushing) {
    isFlushing = true;
    queueMicrotask(flushEffects);
  }
}

function flushEffects() {
  for (const effect of pendingEffects) {
    effect();
  }
  pendingEffects.clear();
  isFlushing = false;
}

/**
 * Creates a signal (reactive value) with subscribe/notify mechanism.
 * @template T
 * @param {T} value
 * @returns {[() => T, (newValue: T) => void]}
 */
export function createSignal(value) {
  /** @type {Set<Function>} */
  const subscribers = new Set();

  /**
   * @returns {T}
   */
  const read = () => {
    const effect = effects[effects.length - 1];
    if (effect) {
      // We're in an effect, so subscribe to changes
      // This is a Set, because there can be multiple reads in a single effect
      subscribers.add(effect);
    }
    return value;
  };

  /**
   * @param {T} newValue
   */
  const write = (newValue) => {
    if (value === newValue) return;
    value = newValue;
    subscribers.forEach((subscriber) => scheduleEffect(subscriber));
  };

  return [read, write];
}

/**
 * Runs a function as an effect, subscribing it to any signals it reads.
 * @param {Function} fn
 */
export function createEffect(fn) {
  const effect = () => {
    effects.push(effect);
    fn();
    effects.pop();
  };
  effect(); // Run once to subscribe
}

/**
 * Creates a computed signal derived from other signals.
 * @param {Function} fn
 * @returns {Function}
 */
export function computed(fn) {
  const [value, setValue] = createSignal(undefined);
  createEffect(() => setValue(fn()));
  return value;
}
