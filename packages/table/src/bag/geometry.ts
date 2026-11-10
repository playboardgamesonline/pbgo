import { type BufferGeometry, LatheGeometry, Vector2, Vector3 } from "three"
import { litLathe } from "../cup/geometry"
import { BAG_SIZE } from "./settings"

/** How high a bag is at the unit width, where its belly is one unit across */
export const BAG_HEIGHT = 1.115

/** How high the rim of its mouth is at the unit width: where what comes out of it comes out */
export const BAG_MOUTH = 1.1

/** How much of its height a bag keeps when it is empty: it slumps to this and swells back as it fills */
export const SLUMP = 0.55

/** A fill is a part of the whole: from 0 to 1, a whole when it is not a number */
export const clampFill = (fill: number) => (Number.isFinite(fill) ? Math.max(0, Math.min(1, fill)) : 1)

/**
 * The middle of the mouth of a bag standing at `at`, on the table: where what is drawn from it comes out. Give it to the `from` of the `Piece` that is drawn and the piece flies from the mouth to its place. A bag that has slumped has its mouth
 * lower, so give the same `fill` as the bag's.
 */
export function bagMouth(at: { x: number; z: number }, size = BAG_SIZE, fill = 1): { x: number; y: number; z: number } {
  return { x: at.x, y: BAG_MOUTH * size * (SLUMP + (1 - SLUMP) * clampFill(fill)), z: at.z }
}

/** The light the dark of the inside of a bag's mouth keeps, and the cord that ties its neck */
const INSIDE_TINT = 0.4
const CORD_TINT = 0.7

/**
 * The profile of a bag at the unit width as [radius, height], in the order a lathe turns it: up the cloth from the middle of its bottom (a round belly, a neck that is tied, a flared mouth) over the rim, then down into the dark of the mouth to the middle of
 * the inside. The bag stands on y = 0. Going up the outside the lathe's normals look away from the axis, and going down the inside toward it, so both face the way they are seen from.
 */
const OUTSIDE = [
  [0, 0],
  [0.2, 0.012],
  [0.36, 0.06],
  [0.46, 0.15],
  [0.5, 0.28],
  [0.485, 0.42],
  [0.41, 0.56],
  [0.29, 0.68],
  [0.19, 0.76],
  [0.15, 0.81],
  [0.162, 0.835],
  [0.162, 0.865],
  [0.15, 0.89],
  [0.19, 0.95],
  [0.27, 1.03],
  [0.31, 1.09],
  [0.29, 1.115],
] as const
const INSIDE = [
  [0.255, 1.1],
  [0.2, 1.03],
  [0.15, 0.96],
  [0.12, 0.9],
  [0, 0.88],
] as const

export const BAG_PROFILE: readonly (readonly [number, number])[] = [...OUTSIDE, ...INSIDE]
/** The points of the profile that are the cord that ties the neck */
const CORD = [10, 11]
const SEGMENTS = 48

/** How many folds the gathered cloth of the neck and the mouth has all round */
export const BAG_FOLDS = 7

/** How far each point of the profile waves, as a part of its radius: nothing on the belly, then more and more up the neck to the rim, and less again down into the mouth */
export const BAG_WAVES: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.02, 0.03, 0.05, 0.08, 0.11, 0.14, 0.14, 0.14, 0.1, 0.05, 0.02, 0]

/**
 * A bag the width of `size` across its belly, turned on a lathe, standing on y = 0, the cloth of its neck and its mouth gathered into folds, the dark of its mouth and the cord of its neck darker than its cloth. One material. The lathe is round, so
 * the folds are made by moving each point of its profile in and out as it goes round (more toward the rim), and the normals are worked out again for the new surface, the two ends of the seam sharing theirs.
 */
export function bagGeometry(size: number): BufferGeometry {
  const geometry = new LatheGeometry(BAG_PROFILE.map(([radius, y]) => new Vector2(radius * size, y * size)), SEGMENTS)
  const points = BAG_PROFILE.length
  const position = geometry.getAttribute("position")
  for (let vertex = 0; vertex < position.count; vertex++) {
    const wave = BAG_WAVES[vertex % points] ?? 0
    if (wave === 0) continue
    const [x, y, z] = [position.getX(vertex), position.getY(vertex), position.getZ(vertex)]
    const scale = 1 + wave * Math.sin(BAG_FOLDS * Math.atan2(z, x))
    position.setXYZ(vertex, x * scale, y, z * scale)
  }
  geometry.computeVertexNormals()
  // A lathe lists the first turn and the last at the same place: their normals are the same
  const normal = geometry.getAttribute("normal")
  const [first, last, shared] = [new Vector3(), new Vector3(), new Vector3()]
  for (let point = 0; point < points; point++) {
    const [a, b] = [point, SEGMENTS * points + point]
    shared.addVectors(first.fromBufferAttribute(normal, a), last.fromBufferAttribute(normal, b)).normalize()
    normal.setXYZ(a, shared.x, shared.y, shared.z)
    normal.setXYZ(b, shared.x, shared.y, shared.z)
  }
  return litLathe(geometry, points, (point) => (point >= OUTSIDE.length ? INSIDE_TINT : CORD.includes(point) ? CORD_TINT : 1))
}

/** How many points of the profile are the outside of the bag */
export const BAG_OUTSIDE_POINTS = OUTSIDE.length
