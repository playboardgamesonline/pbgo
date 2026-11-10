import { Vector3 } from "three"

/** What counts as the same distance when a solid is worked out from its corners */
const EPSILON = 1e-6

export type HullFace = {
  /** The corners of the face, as indexes of the points given, in the order that goes counterclockwise seen from outside */
  corners: number[]
  /** The direction the face looks at, unit length, pointing away from the middle */
  normal: Vector3
  /** How far the plane of the face is from the origin */
  distance: number
}

/**
 * The flat faces of the convex solid whose corners are `points`, middle of the solid on the origin: every plane through three corners that has all the others on one side, with the corners that lie on it. A face of a
 * die is a triangle (d8, d20), a square, a kite (d10) or a pentagon (d12), so this is all a solid needs to be made of its corners.
 */
export function hullFaces(points: readonly Vector3[], epsilon = EPSILON): HullFace[] {
  const faces: HullFace[] = []
  const n = points.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const normal = points[j]!.clone().sub(points[i]!).cross(points[k]!.clone().sub(points[i]!))
        if (normal.lengthSq() < epsilon) continue
        normal.normalize()
        let distance = normal.dot(points[i]!)
        let above = false
        let below = false
        for (let m = 0; m < n && !(above && below); m++) {
          const side = normal.dot(points[m]!) - distance
          if (side > epsilon) above = true
          else if (side < -epsilon) below = true
        }
        if (above && below) continue
        if (above) {
          normal.negate()
          distance = -distance
        }
        if (faces.some((face) => face.normal.distanceTo(normal) < 1e-5 && Math.abs(face.distance - distance) < 1e-5)) continue
        faces.push({ corners: [], normal, distance })
      }
    }
  }
  for (const face of faces) {
    const on = points.flatMap((point, index) => (Math.abs(face.normal.dot(point) - face.distance) <= epsilon * 10 ? [index] : []))
    face.corners = around(on, points, face.normal)
  }
  return faces
}

/** The corners ordered counterclockwise round the normal, seen from where it points */
function around(corners: number[], points: readonly Vector3[], normal: Vector3): number[] {
  const centre = corners.reduce((sum, index) => sum.add(points[index]!), new Vector3()).divideScalar(corners.length)
  const reference = Math.abs(normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
  const u = reference.clone().sub(normal.clone().multiplyScalar(reference.dot(normal))).normalize()
  const v = normal.clone().cross(u)
  const angle = (index: number) => {
    const d = points[index]!.clone().sub(centre)
    return Math.atan2(d.dot(v), d.dot(u))
  }
  return [...corners].sort((a, b) => angle(a) - angle(b))
}
