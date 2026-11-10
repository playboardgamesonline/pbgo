import { SKETCH_GRID, type Stroke } from "./sheet"

/** What strokes are drawn with: a colour for each index of the game's palette, and a width for each index of its brushes, as a part of the width of the sheet */
export type Inks = { colors: readonly string[]; widths: readonly number[] }

/** The colour and the width of a stroke whose index the game's palette has no entry for: the drawing is the engine's, and a game that narrowed its palette must not break on what an older table holds */
const FALLBACK = { color: "#26231f", width: 0.01 }

/** The paper: a sheet with rounded corners and a faint edge, on a canvas of `width` by `height` pixels */
export function paintPaper(g: CanvasRenderingContext2D, width: number, height: number, paper: string): void {
  g.clearRect(0, 0, width, height)
  g.beginPath()
  g.roundRect(0, 0, width, height, Math.min(width, height) * 0.035)
  g.fillStyle = paper
  g.fill()
  g.lineWidth = 3
  g.strokeStyle = "rgba(0, 0, 0, 0.16)"
  g.stroke()
}

/**
 * Draws strokes on a canvas of `width` by `height` pixels, the points of the grid taken across it. A line goes through the middle of each pair of its points with a curve that is bent by the point between, so that the few points a thinned stroke
 * keeps are not seen as corners; one point is a dot, and two a straight line. The ends are round.
 */
export function paintStrokes(g: CanvasRenderingContext2D, strokes: readonly Stroke[], { colors, widths }: Inks, width: number, height: number): void {
  g.lineCap = "round"
  g.lineJoin = "round"
  for (const stroke of strokes) {
    const color = colors[stroke.color] ?? FALLBACK.color
    const size = Math.max(1.5, (widths[stroke.width] ?? FALLBACK.width) * width)
    const { points } = stroke
    const x = (i: number) => ((points[i] ?? 0) / SKETCH_GRID) * width
    const y = (i: number) => ((points[i + 1] ?? 0) / SKETCH_GRID) * height
    g.strokeStyle = color
    g.fillStyle = color
    g.lineWidth = size
    g.beginPath()
    if (points.length <= 2) {
      g.arc(x(0), y(0), size / 2, 0, Math.PI * 2)
      g.fill()
      continue
    }
    g.moveTo(x(0), y(0))
    for (let i = 2; i < points.length - 2; i += 2) g.quadraticCurveTo(x(i), y(i), (x(i) + x(i + 2)) / 2, (y(i) + y(i + 2)) / 2)
    g.lineTo(x(points.length - 2), y(points.length - 2))
    g.stroke()
  }
}
