// The numbers behind the table's mat and its pool of light: pure, so that they are tested without a canvas.

import { hexChannels, seeded } from "./grain-field"

/** How much of a pool of light is left at `t`, its distance from the middle as a share of its radius (0 to 1): the whole at the middle, nothing at the edge, and smooth between, so that the edge of the plane never shows */
export function poolFalloff(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  const k = x * x * (3 - 2 * x)
  return 1 - k
}

/** The colour stops of the radial gradient of a pool of light: the light's colour at the middle, black (which adds nothing) at the edge, each stop `poolFalloff` of the light between */
export function poolStops(color: string, steps = 12): { at: number; rgb: string }[] {
  const [r, g, b] = hexChannels(color)
  return Array.from({ length: steps + 1 }, (_, i) => {
    const at = i / steps
    const k = poolFalloff(at)
    return { at, rgb: `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})` }
  })
}

/**
 * The lines of a diamond lattice on a `size` by `size` square that repeats with no seam: `diamonds` diamonds across, so every line that leaves the square at one edge comes back in at the opposite one. Each line is two points, going down to the right and then going down to the left,
 * and the ones that leave the square are carried one square over, so that the picture is whole whatever the width of the line.
 */
export function latticeLines(size: number, diamonds: number): { from: [number, number]; to: [number, number] }[] {
  const spacing = size / diamonds
  const lines: { from: [number, number]; to: [number, number] }[] = []
  for (let k = -diamonds; k <= diamonds * 2; k++) {
    lines.push({ from: [k * spacing, 0], to: [k * spacing + size, size] })
    lines.push({ from: [k * spacing, 0], to: [k * spacing - size, size] })
  }
  return lines
}

/** A number between 0 and 1 for each whole number, the same on every client: a hash, not `Math.random` */
export function unit(n: number): number {
  let h = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * A colour level rounded up or down by chance, in proportion to what it has after the point (12.3 is 13 three times in ten): the levels of a gradient that is painted in 8 bits then step by a level here and there instead of all along a line, and the gradient
 * shows no bands. The change is of one level, 0.4 % of the range, which no eye sees as a grain.
 */
export const dithered = (level: number, index: number) => Math.floor(level + unit(index))

/** The `#rrggbb` of three channels, each held between 0 and 255 */
export function hexOf(r: number, g: number, b: number): string {
  const part = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0")
  return `#${part(r)}${part(g)}${part(b)}`
}

/** The light a pool must add to a table of colour `table` so that its middle is `center`: what `center` has more than the table, channel by channel, and nothing for a channel it has less of */
export function lightBetween(center: string, table: string): string {
  const [cr, cg, cb] = hexChannels(center)
  const [tr, tg, tb] = hexChannels(table)
  return hexOf(cr - tr, cg - tg, cb - tb)
}

/**
 * The pixels of a pool of light on a `size` by `size` square, red, green, blue and alpha row by row: the light's colour at the middle, easing away to black at the edge (`poolFalloff`), to be added to the table, each level dithered (`dithered`) so that its 8 bits do not band.
 * A dark pool over a dark table is where the bands show, and where the eye looks.
 */
export function poolPixels(color: string, size: number): Uint8ClampedArray {
  const [r, g, b] = hexChannels(color)
  const out = new Uint8ClampedArray(size * size * 4)
  const half = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const light = poolFalloff(Math.hypot(x + 0.5 - half, y + 0.5 - half) / half)
      const o = (y * size + x) * 4
      out[o] = dithered(r * light, o)
      out[o + 1] = dithered(g * light, o + 1)
      out[o + 2] = dithered(b * light, o + 2)
      out[o + 3] = 255
    }
  }
  return out
}

/** The centre of a cell of a cracked-glass mosaic, in shares of the repeat, and the shade of the cell: -1 for a cell a little darker than the mat, 1 for one a little lighter */
export type MosaicPoint = { x: number; y: number; shade: number }

/** How wide a crack is, in cell widths: the gap between the nearest centre and the next, under which a pixel is on a border */
const CRACK_WIDTH = 0.09

/** One point in each cell of a `cells` by `cells` grid, kept off the cell's edge and moved about in it by the seed, each with a shade: the centres of a cracked-glass mosaic. The same seed gives the same mosaic on every client */
export function mosaicPoints(cells: number, seed: number): MosaicPoint[] {
  const random = seeded(seed)
  return Array.from({ length: cells * cells }, (_, i) => ({ x: ((i % cells) + 0.15 + 0.7 * random()) / cells, y: (Math.floor(i / cells) + 0.15 + 0.7 * random()) / cells, shade: random() * 2 - 1 }))
}

/**
 * The mosaic at (`x`, `y`), in shares of one repeat: the shade of the cell the point lies in, and how close it is to a crack between two cells, 0 (far from any) to 1 (on one). It repeats every 1 across and down, so the square it is painted on tiles with no seam:
 * a distance is taken the short way round, and the points of the cells on the other side of an edge are the ones that wrap.
 */
export function mosaicAt(points: readonly MosaicPoint[], cells: number, x: number, y: number): { shade: number; crack: number } {
  const cx = Math.floor(x * cells)
  const cy = Math.floor(y * cells)
  const wrapped = (d: number) => d - Math.round(d)
  const cell = (n: number) => ((n % cells) + cells) % cells
  let first = Infinity
  let second = Infinity
  let shade = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const point = points[cell(cy + dy) * cells + cell(cx + dx)]!
      const distance = Math.hypot(wrapped(x - point.x), wrapped(y - point.y))
      if (distance < first) {
        second = first
        first = distance
        shade = point.shade
      } else if (distance < second) second = distance
    }
  }
  return { shade, crack: Math.max(0, 1 - ((second - first) * cells) / CRACK_WIDTH) }
}
