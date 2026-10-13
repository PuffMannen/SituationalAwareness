/**
 * A value computed at most once per task, with a way to drop it early.
 * @template T
 * @typedef {(() => T) & {clear: () => void}} TaskCache
 */

/**
 * Wrap a computation so callers in the same synchronous run share one result. Every token's
 * visibility check in one canvas refresh, for example, reads settings once instead of once per
 * token. The value is dropped in a microtask, so the next event or frame computes it again.
 * @template T
 * @param {() => T} compute
 * @returns {TaskCache<T>}
 */
export function cachePerTask(compute) {
  let cached = null;
  let valid = false;
  const get = () => {
    if ( valid ) return cached;
    cached = compute();
    valid = true;
    queueMicrotask(get.clear);
    return cached;
  };
  get.clear = () => {
    cached = null;
    valid = false;
  };
  return get;
}
