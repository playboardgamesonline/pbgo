import { BufferGeometry, Float32BufferAttribute, LatheGeometry, ShapeUtils, SphereGeometry, Vector2, Vector3 } from "three"
import { dieGeometry } from "../die/geometry"
import type { Outline } from "./outline"

/** An angle between two walls under which they are one smooth surface (the walls of a disc) and over which they are an edge (the walls of a hexagon): the cosine of about thirty-five degrees */
const SMOOTH = 0.82

/** The `color` attribute every piece has, one grey per vertex, which the piece rewrites as it turns to light it: a geometry belongs to one piece and is never shared */
function lit(geometry: BufferGeometry): BufferGeometry {
  geometry.setAttribute("color", new Float32BufferAttribute(new Array<number>(geometry.getAttribute("position").count * 3).fill(1), 3))
  geometry.computeBoundingSphere()
  return geometry
}

/** A geometry that has one material, for everything of it */
function whole(geometry: BufferGeometry): BufferGeometry {
  geometry.clearGroups()
  geometry.addGroup(0, geometry.getIndex() ? geometry.getIndex()!.count : geometry.getAttribute("position").count, 0)
  return lit(geometry)
}

/**
 * A flat piece with the edge of `outline`, `height` high, standing on the table with its base at y = 0: a disc, a tile of any shape, a silhouette. The outline is in units of the piece's width and `size` makes it the piece's own; its x runs to the
 * right and its y away from the viewer, the way a card lies face up. The material groups are 0 for the walls, 1 for the top and 2 for the bottom, each of which lays a picture over the outline's box (the bottom's mirrored, so that it reads right
 * when the piece is turned over). The top and the bottom are cut into triangles whatever the shape, concave ones included.
 */
export function prismGeometry(outline: Outline, height: number, size: number): BufferGeometry {
  const n = outline.length
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  const geometry = new BufferGeometry()
  const point = (i: number) => outline[((i % n) + n) % n]!
  // The wall that starts at corner i faces away from the polygon's middle: the right of the way its edge runs, as the outline goes counterclockwise
  const wall = (i: number) => {
    const [x, y] = point(i)
    const [nx, ny] = point(i + 1)
    const length = Math.hypot(nx - x, ny - y)
    return new Vector3((ny - y) / length, 0, (nx - x) / length)
  }
  const normalAt = (corner: number, own: Vector3, other: Vector3) => (own.dot(other) > SMOOTH ? own.clone().add(other).normalize() : own)
  let perimeter = 0
  for (let i = 0; i < n; i++) perimeter += Math.hypot(point(i + 1)[0] - point(i)[0], point(i + 1)[1] - point(i)[1])

  // The walls: a quad for each edge, its corners lit by the wall it belongs to unless the next wall bends away gently
  let walked = 0
  for (let i = 0; i < n; i++) {
    const a = point(i)
    const b = point(i + 1)
    const own = wall(i)
    const first = positions.length / 3
    const nA = normalAt(i, own, wall(i - 1))
    const nB = normalAt(i + 1, own, wall(i + 1))
    const along = Math.hypot(b[0] - a[0], b[1] - a[1]) / perimeter
    const corners: [number, number, number, Vector3, number, number][] = [
      [a[0] * size, 0, -a[1] * size, nA, walked / 1, 0],
      [b[0] * size, 0, -b[1] * size, nB, walked + along, 0],
      [b[0] * size, height * size, -b[1] * size, nB, walked + along, 1],
      [a[0] * size, height * size, -a[1] * size, nA, walked, 1],
    ]
    for (const [x, y, z, normal, u, v] of corners) {
      positions.push(x, y, z)
      normals.push(normal.x, normal.y, normal.z)
      uvs.push(u, v)
    }
    // Seen from outside the corners go counterclockwise: the bottom one, the next, then the two above
    const flip = new Vector3(corners[1]![0] - corners[0]![0], 0, corners[1]![2] - corners[0]![2]).cross(new Vector3(0, 1, 0)).dot(own) < 0
    index.push(...(flip ? [first, first + 2, first + 1, first, first + 3, first + 2] : [first, first + 1, first + 2, first, first + 2, first + 3]))
    walked += along
  }
  geometry.addGroup(0, index.length, 0)

  // The top and the bottom: the same triangles, one facing up and one down
  const triangles = ShapeUtils.triangulateShape(
    outline.map(([x, y]) => new Vector2(x, y)),
    [],
  )
  const cap = (top: boolean) => {
    const first = positions.length / 3
    for (const [x, y] of outline) {
      positions.push(x * size, top ? height * size : 0, -y * size)
      normals.push(0, top ? 1 : -1, 0)
      uvs.push(x + 0.5, top ? y + 0.5 : 0.5 - y)
    }
    const start = index.length
    for (const [a, b, c] of triangles) {
      // The triangles are made to go counterclockwise in the outline, which is counterclockwise seen from above
      const [pa, pb, pc] = [outline[a!]!, outline[b!]!, outline[c!]!]
      const counterclockwise = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]) > 0
      const up = counterclockwise ? [a!, b!, c!] : [a!, c!, b!]
      index.push(...(top ? up : [...up].reverse()).map((corner) => first + corner))
    }
    geometry.addGroup(start, index.length - start, top ? 1 : 2)
  }
  cap(true)
  cap(false)

  geometry.setIndex(index)
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3))
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2))
  return lit(geometry)
}

/** A cube with its corners cut, `size` along each edge, standing on the table with its base at y = 0. One material */
export function cubeGeometry(size: number): BufferGeometry {
  const geometry = dieGeometry(size)
  geometry.translate(0, size / 2, 0)
  return whole(geometry)
}

/** A sphere of the diameter `size` resting on the table at y = 0. One material */
export function sphereGeometry(size: number): BufferGeometry {
  const geometry = new SphereGeometry(size / 2, 32, 18)
  geometry.translate(0, size / 2, 0)
  return whole(geometry)
}

/** The profile of a pawn, from its base up, as [radius, height] at the unit width: a wide foot, a neck, a collar and a round head */
const PAWN = [
  [0, 0],
  [0.5, 0],
  [0.5, 0.05],
  [0.46, 0.1],
  [0.36, 0.17],
  [0.24, 0.3],
  [0.17, 0.55],
  [0.15, 0.78],
  [0.3, 0.84],
  [0.3, 0.9],
  [0.15, 0.95],
  [0.2, 1.0],
  [0.27, 1.1],
  [0.28, 1.2],
  [0.24, 1.3],
  [0.15, 1.38],
  [0, 1.42],
] as const

/** How high a pawn is at the unit width */
export const PAWN_HEIGHT = 1.42

/** A pawn the width of `size` at its foot, turned on a lathe from the profile above, standing at y = 0. One material */
export function pawnGeometry(size: number): BufferGeometry {
  return whole(new LatheGeometry(PAWN.map(([radius, y]) => new Vector2(radius * size, y * size)), 40))
}
