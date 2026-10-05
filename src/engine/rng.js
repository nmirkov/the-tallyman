// Deterministic RNG (A1, A3): mulberry32 whose whole state is the uint32 `state.rng`.
// The engine never uses Math.random; every random choice goes through these functions.

/**
 * Advances `state.rng` and returns a float in [0, 1).
 * @param {{rng: number}} state
 * @returns {number}
 */
export function next(state) {
  const a = (state.rng + 0x6d2b79f5) >>> 0;
  state.rng = a;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Integer in [0, n). `n` must be a positive integer (a developer error otherwise).
 * @param {{rng: number}} state
 * @param {number} n
 * @returns {number}
 */
export function int(state, n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`rng.int: n must be a positive integer, got ${n}`);
  return Math.floor(next(state) * n);
}

/**
 * A uniformly chosen element; `undefined` (and no RNG step) for an empty array.
 * @template T
 * @param {{rng: number}} state
 * @param {T[]} arr
 * @returns {T|undefined}
 */
export function pick(state, arr) {
  if (!arr.length) return undefined;
  return arr[int(state, arr.length)];
}
