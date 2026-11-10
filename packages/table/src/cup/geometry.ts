import { BufferGeometry, Float32BufferAttribute, LatheGeometry, type Quaternion, Vector2 } from "three"
import { shadeTinted } from "../die/shade"

/** How high a cup is at the unit width, where its mouth is one unit across */
export const CUP_HEIGHT = 1.12

/** The light an inside keeps, against the outside: the dark of a cup's hollow */
export const INSIDE_TINT = 0.55

/**
 * The profile of a cup at the unit width as [radius, height], in the order a lathe turns it: from the middle of the ceiling of the hollow down the inside wall to the inner edge of the mouth, across the rim, then up the outside wall to the base
 * and across it to the middle. The cup stands with its mouth on y = 0, as a cup does that is turned over on the table, and its base at the top. Going down the inside the lathe's normals look toward the axis, and going up the outside away from it, so
 * both walls face the way they are seen from.
 */
const INSIDE = [
  [0, 1.075],
  [0.3, 1.075],
  [0.36, 1.055],
  [0.392, 1.0],
  [0.425, 0.9],
  [0.447, 0.5],
  [0.455, 0.12],
  [0.455, 0],
] as const
const OUTSIDE = [
  [0.5, 0],
  [0.5, 0.04],
  [0.49, 0.12],
  [0.47, 0.5],
  [0.445, 0.9],
  [0.43, 1.02],
  [0.4, 1.08],
  [0.34, 1.112],
  [0.26, 1.12],
  [0, 1.12],
] as const

export const CUP_PROFILE: readonly (readonly [number, number])[] = [...INSIDE, ...OUTSIDE]
/** How many points of the profile belong to the inside of the hollow */
export const CUP_INSIDE_POINTS = INSIDE.length
const SEGMENTS = 48

/**
 * The `color` and `tint` attributes of a lathe that is lit by turning it: one grey per vertex, which the solid rewrites as it turns, and the share of light each vertex keeps, from the point of the profile it is on (`tint` says it for each of the
 * `points`). A lathe lists its vertices turn by turn, the points of the profile one after the other.
 */
export function litLathe(geometry: BufferGeometry, points: number, tint: (point: number) => number): BufferGeometry {
  const count = geometry.getAttribute("position").count
  geometry.setAttribute("color", new Float32BufferAttribute(new Array<number>(count * 3).fill(1), 3))
  geometry.setAttribute("tint", new Float32BufferAttribute(Array.from({ length: count }, (_, vertex) => tint(vertex % points)), 1))
  geometry.computeBoundingSphere()
  return geometry
}

/** A cup the width of `size` across its mouth, turned on a lathe, hollow, with its mouth on y = 0 and its base at the top, its hollow darker than its outside. One material */
export function cupGeometry(size: number): BufferGeometry {
  return litLathe(new LatheGeometry(CUP_PROFILE.map(([radius, y]) => new Vector2(radius * size, y * size)), SEGMENTS), CUP_PROFILE.length, (point) => (point < CUP_INSIDE_POINTS ? INSIDE_TINT : 1))
}

/** Lights a geometry made like a cup's for the way it is turned (`quaternion`, in the world's frame): writes its `color` from its normals and its `tint` */
export function shadeLathe(geometry: BufferGeometry, quaternion: Quaternion): void {
  const colors = geometry.getAttribute("color")
  shadeTinted(geometry.getAttribute("normal").array, geometry.getAttribute("tint").array, quaternion, colors.array as Float32Array)
  colors.needsUpdate = true
}

