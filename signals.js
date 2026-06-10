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

/** @type {Map<Function, Set<Set<Function>>>} */
const effectDeps = new Map();

/**
 * @param {Function} effect
 */
function cleanup(effect) {
  const deps = effectDeps.get(effect);
  if (deps) {
    for (const subscribers of deps) {
      subscribers.delete(effect);
    }
    deps.clear();
  }
}

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
  const toRun = [...pendingEffects];
  pendingEffects.clear();
  isFlushing = false;
  for (const effect of toRun) {
    effect();
  }
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
      subscribers.add(effect);
      if (!effectDeps.has(effect)) {
        effectDeps.set(effect, new Set());
      }
      effectDeps.get(effect)?.add(subscribers);
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
 * Cleans up previous subscriptions before each re-run to prevent leaks.
 * @param {Function} fn
 */
export function createEffect(fn) {
  const effect = () => {
    cleanup(effect);
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
