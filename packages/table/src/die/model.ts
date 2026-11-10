import { type BufferGeometry, Quaternion, Vector3 } from "three"
import { hullFaces } from "./hull"

const UP = new Vector3(0, 1, 0)

/** One face of a die, in the die's own frame and at the unit size: the distance across two opposite faces is 1 */
export type FaceInfo = {
  /** The direction the face looks at, unit length */
  normal: Vector3
  /** The middle of the face */
  centre: Vector3
  /** The corners of the flat part of the face, counterclockwise seen from outside */
  corners: Vector3[]
  /** How far the middle of the face is from the middle of the die */
  inradius: number
}

/**
 * A die's shape: how many faces it has, where each looks, the corners of the solid (what the physics collides), the ways it can be turned onto itself (what lets a roll end on any number) and how it is drawn. A game gives
 * its own with `makeDieModel`, from the corners of a solid that was made in a modelling tool, and the ones the package has are in `solids.ts`.
 *
 * Everything is at the unit size, where the distance across two opposite faces is 1; a `Die` multiplies it by its `size`.
 */
export type DieModel = {
  name: string
  /** The number of faces: a value is a number of 0 to `sides - 1`, the label, until the game gives the real values */
  sides: number
  faces: readonly FaceInfo[]
  /** The corners of the solid, what the physics collides and what lies lowest */
  hull: readonly Vector3[]
  /** The face on the other side of each face, or -1 when it has none */
  opposite: readonly number[]
  /** The turns of the die onto itself, each as where it takes every face: `turn[face]` is the face that one lands on. The identity is the first */
  symmetries: readonly (readonly number[])[]
  /** The label each face carries when the die is new: a permutation of 0 to `sides - 1`, in which opposite faces add up to `sides - 1` */
  labels: readonly number[]
  /** The drawn die at a size: its groups are 0 for what no face covers (the bevels) and `face + 1` for each face */
  geometry: (size: number) => BufferGeometry
}

const same = (a: Vector3, b: Vector3, epsilon = 1e-4) => a.distanceTo(b) < epsilon

/** How far the lowest corner of a die turned by `q` reaches below its middle, at the unit size */
export function dropOf(model: DieModel, q: Quaternion): number {
  const { x, y, z, w } = q
  const rx = 2 * (x * y + w * z)
  const ry = 1 - 2 * (x * x + z * z)
  const rz = 2 * (y * z - w * x)
  let lowest = Infinity
  for (const corner of model.hull) lowest = Math.min(lowest, rx * corner.x + ry * corner.y + rz * corner.z)
  return -lowest
}

/** The turn that brings a face to the top */
export function faceUpQuaternion(model: DieModel, face: number): Quaternion {
  return new Quaternion().setFromUnitVectors(model.faces[face]!.normal, UP)
}

/** How a die lies once it has stopped, `face` on top and the whole die turned by `yaw` radians about the vertical axis, counterclockwise seen from above */
export function restingQuaternion(model: DieModel, face: number, yaw = 0): Quaternion {
  return new Quaternion().setFromAxisAngle(UP, yaw).multiply(faceUpQuaternion(model, face))
}

const looking = new Vector3()

/** The face that looks up the most when the die is turned by `q`, and how closely it looks up (1 is straight up) */
export function upFaceOf(model: DieModel, q: Quaternion): { face: number; flatness: number } {
  let face = 0
  let flatness = -Infinity
  model.faces.forEach((info, index) => {
    const y = looking.copy(info.normal).applyQuaternion(q).y
    if (y > flatness) {
      flatness = y
      face = index
    }
  })
  return { face, flatness }
}

/** The face with this normal, or -1 */
function faceLooking(faces: readonly FaceInfo[], normal: Vector3): number {
  return faces.findIndex((face) => same(face.normal, normal))
}

/**
 * Every way the solid turns onto itself: for each face and each face it could land on, the turn that takes the first to the second with its first corner on each corner of the second in turn, kept when it takes every
 * corner of the solid onto a corner. Each is returned as the face it takes each face to.
 */
function turnsOf(faces: readonly FaceInfo[], hull: readonly Vector3[]): number[][] {
  const found = new Map<string, number[]>()
  const base = new Quaternion()
  const twist = new Quaternion()
  const turn = new Quaternion()
  const moved = new Vector3()
  const start = new Vector3()
  const goal = new Vector3()
  for (let from = 0; from < faces.length; from++) {
    for (let to = 0; to < faces.length; to++) {
      const source = faces[from]!
      const target = faces[to]!
      base.setFromUnitVectors(source.normal, target.normal)
      start.copy(source.corners[0]!).sub(source.centre).applyQuaternion(base)
      for (const corner of target.corners) {
        goal.copy(corner).sub(target.centre)
        twist.setFromAxisAngle(target.normal, Math.atan2(target.normal.dot(start.clone().cross(goal)), start.dot(goal)))
        turn.copy(twist).multiply(base)
        if (!hull.every((point) => hull.some((other) => same(moved.copy(point).applyQuaternion(turn), other)))) continue
        const permutation = faces.map((face) => faceLooking(faces, moved.copy(face.normal).applyQuaternion(turn)))
        if (permutation.includes(-1)) continue
        found.set(permutation.join(","), permutation)
      }
    }
  }
  const identity = faces.map((_, index) => index)
  return [identity, ...[...found.values()].filter((permutation) => permutation.some((face, index) => face !== index))]
}

/** The labels a new die carries: faces in order, each given the smallest label left and its opposite face the one that adds up to `sides - 1` */
function labelsOf(sides: number, opposite: readonly number[]): number[] {
  const labels = new Array<number>(sides).fill(-1)
  let next = 0
  for (let face = 0; face < sides; face++) {
    if (labels[face] !== -1) continue
    labels[face] = next
    if (opposite[face]! >= 0) labels[opposite[face]!] = sides - 1 - next
    next++
    while (labels.includes(next)) next++
  }
  // A die with no faces opposite to each other (a tetrahedron) takes the labels in order
  return labels.map((label, face) => (label === -1 ? face : label))
}

export type ModelInput = {
  name: string
  /** The corners of the solid, middle of it on the origin; they are scaled so that the distance across two opposite faces is 1 */
  corners: readonly Vector3[]
  /** The faces a number can lie on, with their corners as indexes of `corners`. Without them every flat face of the solid counts */
  faces?: readonly { corners: readonly number[] }[]
  /** How the solid is drawn, given the model at the unit size. Without it every face is a flat polygon of its own */
  geometry: (model: DieModel, size: number) => BufferGeometry
  /** The label each face carries when new. Without it opposite faces add up to `sides - 1` */
  labels?: readonly number[]
}

/** Makes the model of a die from the corners of its solid: its faces, the face opposite each, the turns onto itself and the labels of a new die */
export function makeDieModel(input: ModelInput): DieModel {
  const found: readonly { corners: readonly number[] }[] = input.faces ?? hullFaces(input.corners)
  const planes = hullFaces(input.corners)
  const raw = found.map((face) => {
    const corners = face.corners.map((index) => input.corners[index]!)
    // The plane of the face: the one the corners lie on, which is the face's own normal and how far it is from the middle
    const plane = planes.find((candidate) => face.corners.every((index) => Math.abs(candidate.normal.dot(input.corners[index]!) - candidate.distance) < 1e-5))
    if (!plane) throw new RangeError(`The corners of a face of ${input.name} do not lie on a plane of its solid`)
    return { corners, normal: plane.normal, distance: plane.distance }
  })
  const scale = 0.5 / (raw.reduce((sum, face) => sum + face.distance, 0) / raw.length)
  const faces: FaceInfo[] = raw.map((face) => ({
    normal: face.normal.clone(),
    // The foot of the perpendicular from the middle of the die: the middle of the face, where its number is written
    centre: face.normal.clone().multiplyScalar(face.distance * scale),
    corners: face.corners.map((corner) => corner.clone().multiplyScalar(scale)),
    inradius: face.distance * scale,
  }))
  const hull = input.corners.map((corner) => corner.clone().multiplyScalar(scale))
  const opposite = faces.map((face) => faceLooking(faces, face.normal.clone().negate()))
  const model: DieModel = {
    name: input.name,
    sides: faces.length,
    faces,
    hull,
    opposite,
    symmetries: turnsOf(faces, hull),
    labels: input.labels ?? labelsOf(faces.length, opposite),
    geometry: (size) => input.geometry(model, size),
  }
  return model
}
