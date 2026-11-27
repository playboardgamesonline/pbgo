import type { MatLayer, SurfaceProps } from "@pbgo/table"
import { Color } from "three"

/**
 * The mat of the table: a wine velvet with a damask woven into it, as the hangings of a court are, drawn by the game and not a photograph (nothing to license, nothing to load, and its colours are the settings'). The damask is a medallion of scrolls and a lily,
 * repeated on a half-drop grid, a hair lighter than the velvet and touched with the gold of the faces, low enough that the cards keep their contrast; a felt grain over it takes the flatness off; the pool of light of the kit lights the middle. The table bakes it
 * once into the picture that repeats over it.
 */

/** Pixels across one repeat of the mat, and world units it covers: a medallion is a little taller than a card, so the pattern reads as a cloth and not as a print */
const TILE_PIXELS = 512
const TILE_WORLD = 7

const mixed = (from: string, to: string, share: number) => `#${new Color(from).lerp(new Color(to), share).getHexString()}`

/** One half of the medallion, the right one, drawn around (0, 0) in a box of 1 by 1.5: the other half is its mirror image */
function half(g: CanvasRenderingContext2D) {
  g.beginPath()
  // the lily at the top: a petal that leans out, and the stem
  g.moveTo(0, -0.7)
  g.bezierCurveTo(0.1, -0.62, 0.12, -0.5, 0.04, -0.42)
  g.bezierCurveTo(0.14, -0.5, 0.26, -0.5, 0.28, -0.6)
  g.bezierCurveTo(0.3, -0.44, 0.16, -0.36, 0.05, -0.36)
  g.lineTo(0, -0.36)
  // the great scroll of the side, which curls in at its foot
  g.moveTo(0.02, -0.28)
  g.bezierCurveTo(0.3, -0.3, 0.46, -0.12, 0.42, 0.08)
  g.bezierCurveTo(0.38, 0.28, 0.16, 0.34, 0.1, 0.2)
  g.bezierCurveTo(0.06, 0.1, 0.16, 0.02, 0.24, 0.08)
  g.bezierCurveTo(0.18, 0.12, 0.16, 0.18, 0.2, 0.2)
  g.bezierCurveTo(0.3, 0.2, 0.34, 0.04, 0.3, -0.06)
  g.bezierCurveTo(0.24, -0.2, 0.1, -0.22, 0.02, -0.2)
  // the leaf in the heart, and the drop under it
  g.moveTo(0, -0.14)
  g.bezierCurveTo(0.1, -0.06, 0.1, 0.08, 0, 0.18)
  g.moveTo(0, 0.26)
  g.bezierCurveTo(0.06, 0.32, 0.06, 0.4, 0, 0.44)
  // the curls of the foot, and the small scroll that answers the lily
  g.moveTo(0.02, 0.5)
  g.bezierCurveTo(0.16, 0.44, 0.3, 0.5, 0.3, 0.62)
  g.bezierCurveTo(0.3, 0.7, 0.2, 0.72, 0.18, 0.66)
  g.bezierCurveTo(0.22, 0.66, 0.24, 0.6, 0.2, 0.58)
  g.bezierCurveTo(0.14, 0.54, 0.06, 0.58, 0.02, 0.6)
  g.lineTo(0, 0.6)
  g.fill()
}

/** The medallion at (x, y), `size` pixels wide */
function medallion(g: CanvasRenderingContext2D, x: number, y: number, size: number) {
  for (const side of [1, -1]) {
    g.save()
    g.translate(x, y)
    g.scale(side * size, size)
    half(g)
    g.restore()
  }
}

/** A small four-petal flower between the medallions, so that the cloth has no empty diamond */
function flower(g: CanvasRenderingContext2D, x: number, y: number, size: number) {
  g.save()
  g.translate(x, y)
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2)
    g.beginPath()
    g.ellipse(0, -size * 0.55, size * 0.18, size * 0.42, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.beginPath()
  g.arc(0, 0, size * 0.14, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

/** The ogee frame: four thin S-curves from the middle of one side of the repeat to the middle of the next, a diamond with waved sides round the middle medallion; the curves of the next repeats close the same frame round the medallions of the corners */
function ogees(g: CanvasRenderingContext2D, size: number) {
  g.lineWidth = size * 0.01
  g.lineCap = "round"
  g.beginPath()
  for (const [sx, sy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    const at = (x: number, y: number): [number, number] => [(0.5 + sx * (x - 0.5)) * size, (0.5 + sy * (y - 0.5)) * size]
    g.moveTo(...at(0.5, 0))
    g.bezierCurveTo(...at(0.7, 0.02), ...at(0.8, 0.48), ...at(1, 0.5))
  }
  g.stroke()
}

/**
 * The damask, painted on a square canvas that repeats with no seam: medallions on a half-drop grid (one in the middle, one shared by the four corners), the flowers where the frames meet (the middle of each side, shared with the next repeat), and the waved
 * frame between them. Everything that crosses an edge is drawn again on the other side, so the repeat joins.
 */
export function paintDamask(size: number, ink: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const g = canvas.getContext("2d")!
  g.fillStyle = ink
  g.strokeStyle = ink
  ogees(g, size)
  const m = size * 0.4
  for (const [x, y] of [
    [0.5, 0.5],
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const)
    medallion(g, x * size, y * size, m)
  for (const [x, y] of [
    [0.5, 0],
    [0.5, 1],
    [0, 0.5],
    [1, 0.5],
  ] as const)
    flower(g, x * size, y * size, size * 0.07)
  return canvas
}

/** The damask of the colours of the settings, painted once for a pair of colours */
const painted = new Map<string, HTMLCanvasElement>()
function damaskOf(ink: string): HTMLCanvasElement {
  let canvas = painted.get(ink)
  if (!canvas) {
    canvas = paintDamask(TILE_PIXELS, ink)
    painted.set(ink, canvas)
  }
  return canvas
}

/**
 * The mat, as data for the shared `Table`: the velvet is `surfaceDark` of the settings, the damask a little of the gold `accent` laid into it, a felt grain over both, and the pool of light the `surface` colour in the middle. Changing the colours in the gamemaster
 * changes the mat with them. In a page with no document (a test), the damask is left out and the mat is the velvet and its grain.
 */
export function matOf({ surface, surfaceDark, accent }: { surface: string; surfaceDark: string; accent: string }, radius: number): SurfaceProps {
  const layers: MatLayer[] = []
  if (typeof document !== "undefined") layers.push({ kind: "picture", picture: damaskOf(mixed(surfaceDark, accent, 0.32)), blend: "normal", opacity: 0.22 })
  layers.push({ kind: "grain", strength: 0.45 })
  return { color: surfaceDark, layers, resolution: TILE_PIXELS, tile: TILE_WORLD, light: { center: surface, radius } }
}
