// The numbers behind the table's grain: pure, so that they are tested without a canvas.

/** A small seeded random generator (mulberry32): the same seed gives the same grain on every client, and a picture of the table never calls `Math.random` */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The red, green and blue (0 to 255) of a `#rrggbb` colour */
export function hexChannels(hex: string): [number, number, number] {
  return [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)) as [number, number, number]
}

/** The coarse grid of the mottling: `size / MOTTLE` cells across, wrapped, so the picture repeats with no seam */
const MOTTLE = 32

/**
 * The grain of a `size` by `size` square as numbers between -1 and 1, row by row: a fine speckle of one pixel and a slow mottling (random values on a coarse grid, smoothly interpolated, wrapping at the edges), the speckle three times as strong.
 * The wrap is exact: the last row and column are followed by the first, so the square repeats with no seam.
 */
export function grainField(size: number, seed: number): Float32Array {
  const random = seeded(seed)
  const cells = Math.max(2, Math.round(size / MOTTLE))
  const grid = Array.from({ length: cells * cells }, () => random() * 2 - 1)
  const out = new Float32Array(size * size)
  const smooth = (t: number) => t * t * (3 - 2 * t)
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells
    const y0 = Math.floor(fy)
    const ty = smooth(fy - y0)
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells
      const x0 = Math.floor(fx)
      const tx = smooth(fx - x0)
      const at = (cx: number, cy: number) => grid[(cy % cells) * cells + (cx % cells)]!
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
      const mottle = top + (bottom - top) * ty
      const speckle = random() * 2 - 1
      out[y * size + x] = speckle * 0.85 + mottle * 0.15
    }
  }
  return out
}
