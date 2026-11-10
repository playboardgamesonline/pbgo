import type { Corner } from "../board/cells"

/** A point on the table: x to the right, z toward the viewer */
export type Point = readonly [x: number, z: number]

/**
 * Where a thing can be let go, in table coordinates (x to the right, z toward the viewer, the same as every place of the table): a circle, a rectangle that may be turned (`yaw`, radians about the vertical axis, counterclockwise from above, as everywhere
 * on the table) and may have rounded corners, or any polygon, such as the corners of a cell of a board.
 */
export type DropShape =
  | { type: "circle"; x: number; z: number; radius: number }
  | { type: "rect"; x: number; z: number; width: number; depth: number; yaw?: number; radius?: number }
  | { type: "polygon"; points: readonly Point[] }

const finite = (...numbers: number[]) => numbers.every(Number.isFinite)

/** A circle of `radius` round the middle (x, z) */
export function circleShape(x: number, z: number, radius: number): DropShape {
  if (!finite(x, z) || !(radius > 0) || !Number.isFinite(radius)) throw new RangeError(`A circle has a middle and a radius above zero, got (${x}, ${z}) and ${String(radius)}`)
  return { type: "circle", x, z, radius }
}

/** A rectangle `width` along x and `depth` along z round the middle (x, z), turned by `yaw`, its corners rounded by `radius` (at most half its smaller side) */
export function rectShape(x: number, z: number, width: number, depth: number, { yaw = 0, radius = 0 }: { yaw?: number; radius?: number } = {}): DropShape {
  if (!finite(x, z, yaw) || !(width > 0) || !(depth > 0) || !Number.isFinite(width) || !Number.isFinite(depth)) throw new RangeError(`A rectangle has a middle and a width and a depth above zero, got (${x}, ${z}), ${String(width)} by ${String(depth)}`)
  if (!(radius >= 0) || radius > Math.min(width, depth) / 2) throw new RangeError(`The corners of a rectangle are rounded by at most half its smaller side, got ${String(radius)} for ${width} by ${depth}`)
  return { type: "rect", x, z, width, depth, ...(yaw === 0 ? {} : { yaw }), ...(radius === 0 ? {} : { radius }) }
}

/** A polygon with at least three corners */
export function polygonShape(points: readonly Point[]): DropShape {
  if (points.length < 3 || points.some(([x, z]) => !finite(x, z))) throw new RangeError(`A polygon has at least three corners, each a pair of numbers, got ${points.length}`)
  return { type: "polygon", points }
}

/** The shape of a cell of a board that is placed on the table (`squareCells`, `hexCells`): its corners are relative to its middle */
export function cellShape(cell: { x: number; z: number; corners: readonly Corner[] }): DropShape {
  return polygonShape(cell.corners.map(([x, z]) => [cell.x + x, cell.z + z] as const))
}

/** Whether the point (x, z) is on the shape, its edge included for a circle and a rectangle. The point of a polygon is judged by the even-odd rule, so a polygon with a notch is not filled across the notch */
export function contains(shape: DropShape, x: number, z: number): boolean {
  switch (shape.type) {
    case "circle":
      return (x - shape.x) ** 2 + (z - shape.z) ** 2 <= shape.radius ** 2
    case "rect": {
      const [dx, dz] = [x - shape.x, z - shape.z]
      const [sin, cos] = [Math.sin(shape.yaw ?? 0), Math.cos(shape.yaw ?? 0)]
      // The point in the frame of the rectangle: x along its width, z along its depth
      const [local, depth] = [Math.abs(dx * cos - dz * sin), Math.abs(dx * sin + dz * cos)]
      const [halfWidth, halfDepth, radius] = [shape.width / 2, shape.depth / 2, shape.radius ?? 0]
      if (local > halfWidth || depth > halfDepth) return false
      // Past the straight part of both sides it is in a corner, which is a quarter of a circle
      const [past, along] = [local - (halfWidth - radius), depth - (halfDepth - radius)]
      return past <= 0 || along <= 0 || past ** 2 + along ** 2 <= radius ** 2
    }
    case "polygon": {
      const { points } = shape
      let inside = false
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, zi] = points[i]!
        const [xj, zj] = points[j]!
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
      }
      return inside
    }
  }
}

/** The area of a polygon, with the points in either order */
function polygonArea(points: readonly Point[]): number {
  let twice = 0
  points.forEach(([x, z], i) => {
    const [nx, nz] = points[(i + 1) % points.length]!
    twice += x * nz - nx * z
  })
  return Math.abs(twice) / 2
}

/** How much of the table the shape covers: the smaller of two shapes that hold a point is the one it is let go on */
export function areaOf(shape: DropShape): number {
  switch (shape.type) {
    case "circle":
      return Math.PI * shape.radius ** 2
    case "rect":
      return shape.width * shape.depth - (4 - Math.PI) * (shape.radius ?? 0) ** 2
    case "polygon":
      return polygonArea(shape.points)
  }
}

/** The middle of the shape: where a label of it goes */
export function centreOf(shape: DropShape): Point {
  switch (shape.type) {
    case "circle":
    case "rect":
      return [shape.x, shape.z]
    case "polygon": {
      const { points } = shape
      let [twice, cx, cz] = [0, 0, 0]
      points.forEach(([x, z], i) => {
        const [nx, nz] = points[(i + 1) % points.length]!
        const cross = x * nz - nx * z
        twice += cross
        cx += (x + nx) * cross
        cz += (z + nz) * cross
      })
      // A polygon with no area has no centroid: its corners' average will do
      if (Math.abs(twice) < 1e-12) return [points.reduce((sum, [x]) => sum + x, 0) / points.length, points.reduce((sum, [, z]) => sum + z, 0) / points.length]
      return [cx / (3 * twice), cz / (3 * twice)]
    }
  }
}

/** How many sides a circle is drawn with, and how many a rounded corner is */
export const CIRCLE_STEPS = 64
const CORNER_STEPS = 8

/**
 * The edge of the shape as a closed list of points, clockwise seen from above (x to the right, z toward the viewer): what is drawn of a zone. A circle is a polygon of `CIRCLE_STEPS` sides, a rounded corner is drawn in eight, a polygon is its own points
 * (turned clockwise if it was given the other way round).
 */
export function outlineOf(shape: DropShape): Point[] {
  switch (shape.type) {
    case "circle":
      return Array.from({ length: CIRCLE_STEPS }, (_, i) => [shape.x + shape.radius * Math.cos((2 * Math.PI * i) / CIRCLE_STEPS), shape.z + shape.radius * Math.sin((2 * Math.PI * i) / CIRCLE_STEPS)] as const)
    case "rect": {
      const [halfWidth, halfDepth, radius] = [shape.width / 2, shape.depth / 2, shape.radius ?? 0]
      const [sin, cos] = [Math.sin(shape.yaw ?? 0), Math.cos(shape.yaw ?? 0)]
      // Each corner, clockwise from the top left: the middle of its arc, and the angle its arc starts at
      const corners: [number, number, number][] = [
        [-(halfWidth - radius), -(halfDepth - radius), Math.PI],
        [halfWidth - radius, -(halfDepth - radius), -Math.PI / 2],
        [halfWidth - radius, halfDepth - radius, 0],
        [-(halfWidth - radius), halfDepth - radius, Math.PI / 2],
      ]
      const local: [number, number][] = corners.flatMap(([cx, cz, start]) =>
        radius === 0
          ? [[cx, cz] as [number, number]]
          : Array.from({ length: CORNER_STEPS + 1 }, (_, i): [number, number] => [cx + radius * Math.cos(start + ((Math.PI / 2) * i) / CORNER_STEPS), cz + radius * Math.sin(start + ((Math.PI / 2) * i) / CORNER_STEPS)]),
      )
      return local.map(([lx, lz]) => [shape.x + lx * cos + lz * sin, shape.z - lx * sin + lz * cos] as const)
    }
    case "polygon": {
      let twice = 0
      shape.points.forEach(([x, z], i) => {
        const [nx, nz] = shape.points[(i + 1) % shape.points.length]!
        twice += x * nz - nx * z
      })
      // With x to the right and z toward the viewer, a positive sum goes clockwise seen from above
      return twice >= 0 ? [...shape.points] : [...shape.points].reverse()
    }
  }
}

/**
 * The corners of a convex polygon moved `width` toward its inside: with the polygon itself, the band along its edge that a zone draws. Each corner moves along the bisector of its two sides, by as much as keeps the band `width` wide, which is at most
 * two and a half times `width` at a sharp corner.
 */
export function insetOf(points: readonly Point[], width: number): Point[] {
  let twice = 0
  points.forEach(([x, z], i) => {
    const [nx, nz] = points[(i + 1) % points.length]!
    twice += x * nz - nx * z
  })
  // The side the inside is on: the left of a side that is walked counterclockwise, the right of one walked clockwise
  const side = twice >= 0 ? 1 : -1
  const normalOf = (from: Point, to: Point): [number, number] => {
    const [dx, dz] = [to[0] - from[0], to[1] - from[1]]
    const length = Math.hypot(dx, dz) || 1
    return [(-side * dz) / length, (side * dx) / length]
  }
  return points.map((point, i) => {
    const [before, after] = [points[(i + points.length - 1) % points.length]!, points[(i + 1) % points.length]!]
    const [a, b] = [normalOf(before, point), normalOf(point, after)]
    // 1 + cos of the angle between the two normals: the miter is as long as the band is wide over the cosine of half the angle between the normals
    const miter = Math.max(1 / 3, 1 + a[0] * b[0] + a[1] * b[1])
    return [point[0] + (width * (a[0] + b[0])) / miter, point[1] + (width * (a[1] + b[1])) / miter] as const
  })
}
