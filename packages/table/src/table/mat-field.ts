// The numbers behind the table's mat and its pool of light: pure, so that they are tested without a canvas.

import { hexChannels } from "./grain-field"

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
