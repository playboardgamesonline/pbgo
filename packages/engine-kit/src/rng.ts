/**
 * Seeded random numbers. Everything an engine draws comes from a `Rng` built from the game seed, so that the same seed and the
 * same actions replay the same game: never `Math.random` or `Date.now` in an engine (`randomSeed` is the one exception, see it).
 */

/** A stream of numbers in [0, 1). */
export type Rng = () => number

/**
 * A stream that knows where it is. Keep `save()` in the state (one number) and `restoreRng` it in the next `apply` to carry on
 * from the same point, so that a game keeps drawing deterministically after its setup.
 */
export type SaveableRng = Rng & { save: () => number }

/** A seeded stream (mulberry32). Only the low 32 bits of `seed` count: see `sideSeed` for streams that must not be linked to it. */
export function createSaveableRng(seed: number): SaveableRng {
  let a = seed >>> 0
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return Object.assign(rng, { save: () => a })
}

/** `createSaveableRng` for a caller that never needs to save the position: same numbers for the same seed. */
export function createRng(seed: number): Rng {
  return createSaveableRng(seed)
}

/**
 * Carries on a stream from a position given by `save()`: the next numbers are the ones the saved stream would have drawn.
 * Throws a `RangeError` for anything but an unsigned 32-bit integer, because a missing or damaged position would silently
 * restart the stream (every game would then draw the same cards).
 */
export function restoreRng(saved: number): SaveableRng {
  if (!Number.isInteger(saved) || saved < 0 || saved >= 2 ** 32) {
    throw new RangeError(`A saved random position is an unsigned 32-bit integer, got ${String(saved)}`)
  }
  return createSaveableRng(saved)
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j] as T, result[i] as T]
  }
  return result
}

/**
 * A fresh game seed (an integer below 2^52, like the server's) for callers that did not provide one.
 * The only function of the kit that is not deterministic: call it from `setup` when `seed` is missing, and nowhere else.
 */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 20) * 2 ** 32 + Math.floor(Math.random() * 2 ** 32)
}

/** Murmur3 finalizer: mixes the bits of a 32-bit integer. */
function mix32(value: number): number {
  let x = value >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return (x ^ (x >>> 16)) >>> 0
}

/**
 * A 32-bit seed derived from the *high* bits of the game seed (the bits above 2^32) and a few public integers.
 * `createRng(seed)` only uses the low 32 bits for the deal, so streams built from this key never reveal anything
 * about the shuffle, even if a client reconstructs them from what it sees. Every stream whose numbers reach a client
 * (opaque card ids above all, see `issueIds`) is a side stream with its own `parts`.
 */
export function sideSeed(seed: number, ...parts: number[]): number {
  let h = mix32(Math.floor(seed / 2 ** 32) ^ 0x9e3779b9)
  for (const part of parts) h = mix32(h + Math.imul(part >>> 0, 0x27d4eb2f))
  return h
}
