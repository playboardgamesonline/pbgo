export type Rng = () => number

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j] as T, result[i] as T]
  }
  return result
}

/** A fresh game seed (an integer below 2^52, like the server's) for callers that did not provide one. */
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
 * about the shuffle, even if a client reconstructs them from what it sees.
 */
export function sideSeed(seed: number, ...parts: number[]): number {
  let h = mix32(Math.floor(seed / 2 ** 32) ^ 0x9e3779b9)
  for (const part of parts) h = mix32(h + Math.imul(part >>> 0, 0x27d4eb2f))
  return h
}
