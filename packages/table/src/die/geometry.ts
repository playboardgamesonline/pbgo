import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three"
import { D6_NORMALS } from "./faces"
import type { DieModel } from "./model"

/** How much of the edge length the chamfer of the edges and corners takes: a die with sharp corners looks like a cube, one with bevelled ones like a die */
export const CHAMFER = 0.09

// For each value, the two directions its picture runs along on the face: u to the right of the picture and v up it. They make a right-handed frame with the normal (u × v = normal), which
// keeps the triangles facing out
const FACE_AXES: readonly (readonly [u: Vector3, v: Vector3])[] = [
  [new Vector3(1, 0, 0), new Vector3(0, 0, -1)],
  [new Vector3(1, 0, 0), new Vector3(0, 1, 0)],
  [new Vector3(0, 0, -1), new Vector3(0, 1, 0)],
  [new Vector3(0, 0, 1), new Vector3(0, 1, 0)],
  [new Vector3(-1, 0, 0), new Vector3(0, 1, 0)],
  [new Vector3(1, 0, 0), new Vector3(0, 0, 1)],
]

type Piece = { positions: Vector3[]; normal: Vector3; uvs?: [number, number][] }

/**
 * A die's body: a cube with its edges and corners bevelled, `size` along each edge and centred on the origin. Its material groups are 0 for the bevels and the corners (the body) and `value`
 * for the face of that value (1 to 6), so that a mesh wears seven materials: the body's colour, then one picture per face. Each face's picture covers the flat part of the face.
 *
 * The geometry has a `color` attribute, one grey per vertex, which the die rewrites as it turns to light it (`shadeVertices`): a geometry belongs to one die and is never shared.
 */
export function dieGeometry(size: number, chamfer = CHAMFER): BufferGeometry {
  const half = size / 2
  const inset = half - size * chamfer
  const body: Piece[] = []
  const faces: Piece[] = []

  // The six faces, each its own picture
  D6_NORMALS.forEach((normal, index) => {
    const [u, v] = FACE_AXES[index]!
    const corner = (a: number, b: number) => normal.clone().multiplyScalar(half).addScaledVector(u, a * inset).addScaledVector(v, b * inset)
    faces.push({
      normal,
      positions: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)],
      uvs: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    })
  })

  // The twelve edges: for each pair of axes and each pair of signs, a strip between the two faces it joins
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]
  const pairs: [number, number, number][] = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 2, 0],
  ]
  for (const [p, q, r] of pairs) {
    for (const sp of [-1, 1]) {
      for (const sq of [-1, 1]) {
        const at = (ap: number, aq: number, ar: number) => new Vector3().addScaledVector(axes[p]!, sp * ap).addScaledVector(axes[q]!, sq * aq).addScaledVector(axes[r]!, ar)
        body.push({
          normal: new Vector3().addScaledVector(axes[p]!, sp).addScaledVector(axes[q]!, sq).normalize(),
          positions: [at(half, inset, -inset), at(half, inset, inset), at(inset, half, inset), at(inset, half, -inset)],
        })
      }
    }
  }

  // The eight corners: a triangle joining the three strips that meet there
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        body.push({
          normal: new Vector3(sx, sy, sz).normalize(),
          positions: [new Vector3(sx * half, sy * inset, sz * inset), new Vector3(sx * inset, sy * half, sz * inset), new Vector3(sx * inset, sy * inset, sz * half)],
        })
      }
    }
  }

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  const geometry = new BufferGeometry()

  // Writes a piece (a triangle or a quad, fanned) and turns its winding the way its normal says it faces
  const add = ({ positions: points, normal, uvs: pictured }: Piece) => {
    const first = positions.length / 3
    points.forEach((point, i) => {
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      uvs.push(...(pictured?.[i] ?? [0, 0]))
    })
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[0]!
      const b = points[i]!
      const c = points[i + 1]!
      const facing = b.clone().sub(a).cross(c.clone().sub(a)).dot(normal)
      index.push(...(facing >= 0 ? [first, first + i, first + i + 1] : [first, first + i + 1, first + i]))
    }
  }

  const group = (pieces: Piece[], material: number) => {
    const start = index.length
    pieces.forEach(add)
    geometry.addGroup(start, index.length - start, material)
  }
  group(body, 0)
  faces.forEach((face, i) => group([face], i + 1))

  geometry.setIndex(index)
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3))
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute("color", new Float32BufferAttribute(new Array<number>(positions.length).fill(1), 3))
  geometry.computeBoundingSphere()
  return geometry
}

/** How far a picture reaches across a flat face, as a share of the picture: the middle of the face, out to its inscribed circle, covers this much of it. What is beyond the picture takes the colour at its edge */
const PICTURE_REACH = 0.78

/**
 * The drawn body of a die that is a plain solid: every face a flat polygon of its own, with its picture laid over the circle inscribed in it and its corners lit by the way it looks. Its material groups are
 * `face + 1` for each face (group 0 is empty), like the cube's, and it has the same `color` attribute that the die rewrites as it turns.
 */
export function polyhedronGeometry(model: DieModel, size: number): BufferGeometry {
  const geometry = new BufferGeometry()
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  geometry.addGroup(0, 0, 0)
  model.faces.forEach((face, f) => {
    const centre = face.centre.clone().multiplyScalar(size)
    const corners = face.corners.map((corner) => corner.clone().multiplyScalar(size))
    // The picture's axes in the plane of the face: it reads upright toward the first corner
    const u = corners[0]!.clone().sub(centre)
    u.sub(face.normal.clone().multiplyScalar(u.dot(face.normal))).normalize()
    const v = face.normal.clone().cross(u)
    // How far the middle of the face is from its nearest edge: the picture is drawn to fit inside that
    let inradius = Infinity
    corners.forEach((corner, i) => {
      const next = corners[(i + 1) % corners.length]!
      const edge = next.clone().sub(corner)
      inradius = Math.min(inradius, edge.clone().cross(centre.clone().sub(corner)).length() / edge.length())
    })
    const scale = PICTURE_REACH / (2 * inradius)
    const first = positions.length / 3
    for (const corner of corners) {
      const d = corner.clone().sub(centre)
      positions.push(corner.x, corner.y, corner.z)
      normals.push(face.normal.x, face.normal.y, face.normal.z)
      uvs.push(0.5 + d.dot(u) * scale, 0.5 + d.dot(v) * scale)
    }
    const start = index.length
    for (let i = 1; i < corners.length - 1; i++) index.push(first, first + i, first + i + 1)
    geometry.addGroup(start, index.length - start, f + 1)
  })
  geometry.setIndex(index)
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3))
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute("color", new Float32BufferAttribute(new Array<number>(positions.length).fill(1), 3))
  geometry.computeBoundingSphere()
  return geometry
}
