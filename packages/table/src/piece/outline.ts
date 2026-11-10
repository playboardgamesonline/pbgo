/** A point of an outline: x to the right and y up the page, the way a piece is seen from above, y running away from the viewer */
export type Point = readonly [x: number, y: number]

/** The edge of a flat piece, seen from above: the corners in order, counterclockwise, inside a box one unit wide and high centred on the origin */
export type Outline = readonly Point[]

/** The area an outline encloses, positive when its corners go counterclockwise */
export function area(outline: readonly Point[]): number {
  let sum = 0
  outline.forEach(([x, y], i) => {
    const [nextX, nextY] = outline[(i + 1) % outline.length]!
    sum += x * nextY - nextX * y
  })
  return sum / 2
}

/**
 * A regular polygon: `sides` corners round the origin, the first at the angle `turn` (radians, counterclockwise from the x axis). The widest side of its box is one unit. A disc is many sides; a hexagon with `turn` 0 has corners left and right and an edge
 * on top, with `Math.PI / 6` a corner on top; a square wants `Math.PI / 4` to stand on an edge.
 */
export function regularOutline(sides: number, turn = 0): Outline {
  if (!Number.isInteger(sides) || sides < 3) throw new RangeError(`A polygon has three sides at the least, got ${String(sides)}`)
  return fitOutline(Array.from({ length: sides }, (_, k) => [Math.cos(turn + (2 * Math.PI * k) / sides), Math.sin(turn + (2 * Math.PI * k) / sides)] as const))
}

/**
 * Any outline made to fit: turned counterclockwise if it goes clockwise, centred on the middle of its box, and scaled so that the widest side of the box is one unit. A game gives the silhouette of a piece (a meeple, a standee) as the corners of its
 * outline, in any size and any place, and gets the same piece whatever the scale of what it drew.
 */
export function fitOutline(points: readonly Point[]): Outline {
  if (points.length < 3) throw new RangeError("An outline has three corners at the least")
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const bottom = Math.min(...ys)
  const top = Math.max(...ys)
  const widest = Math.max(right - left, top - bottom)
  if (!(widest > 0)) throw new RangeError("An outline has some width")
  const fitted = points.map(([x, y]) => [(x - (left + right) / 2) / widest, (y - (bottom + top) / 2) / widest] as const)
  return area(fitted) < 0 ? [...fitted].reverse() : fitted
}

/**
 * An outline with its corners rounded: each corner is cut where it is `radius` from the corner along the two edges (at most half an edge) and joined by a curve. `radius` is in units of the outline, so a share of the piece's width.
 */
export function roundedOutline(outline: Outline, radius: number, segments = 5): Outline {
  if (radius <= 0) return outline
  const rounded: Point[] = []
  outline.forEach(([x, y], i) => {
    const [px, py] = outline[(i + outline.length - 1) % outline.length]!
    const [nx, ny] = outline[(i + 1) % outline.length]!
    const toPrev = Math.hypot(px - x, py - y)
    const toNext = Math.hypot(nx - x, ny - y)
    const cut = Math.min(radius, toPrev / 2, toNext / 2)
    const start: Point = [x + ((px - x) / toPrev) * cut, y + ((py - y) / toPrev) * cut]
    const end: Point = [x + ((nx - x) / toNext) * cut, y + ((ny - y) / toNext) * cut]
    for (let s = 0; s <= segments; s++) {
      const t = s / segments
      // A curve from one cut to the other that leans toward the corner
      rounded.push([(1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * x + t * t * end[0], (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * y + t * t * end[1]])
    }
  })
  return rounded
}

/** The distance from the origin to the farthest corner: the radius of the circle the piece fits in */
export const reach = (outline: readonly Point[]) => Math.max(...outline.map(([x, y]) => Math.hypot(x, y)))
