import { Vector3 } from "three"
import { D6_NORMALS } from "./faces"
import { CHAMFER, dieGeometry, polyhedronGeometry } from "./geometry"
import { hullFaces } from "./hull"
import { type DieModel, makeDieModel } from "./model"

/** The dice the package knows how to make: the number is how many faces */
export const DIE_SHAPES = ["d6", "d8", "d10", "d12", "d20"] as const
export type DieShape = (typeof DIE_SHAPES)[number]

const PHI = (1 + Math.sqrt(5)) / 2

/** The eight corners of a cube with its corners cut off: each is a point at the full half-edge on one axis and the inset one on the others */
function chamferedCorners(): Vector3[] {
  const half = 0.5
  const inset = half - CHAMFER
  const corners: Vector3[] = []
  for (const axis of [0, 1, 2] as const) {
    for (const side of [-1, 1]) {
      for (const a of [-1, 1]) {
        for (const b of [-1, 1]) {
          const point = [0, 0, 0]
          point[axis] = side * half
          point[(axis + 1) % 3] = a * inset
          point[(axis + 2) % 3] = b * inset
          corners.push(new Vector3(...point))
        }
      }
    }
  }
  return corners
}

function d6(): DieModel {
  const corners = chamferedCorners()
  const planes = hullFaces(corners)
  // The six faces a number lies on are the big flat squares, in the order the cube's labels go (1 on top, 2 toward the viewer, 3 to the right)
  const faces = D6_NORMALS.map((normal) => {
    const plane = planes.find((candidate) => candidate.normal.distanceTo(normal) < 1e-6)
    if (!plane) throw new Error("A face of the cube is missing")
    return plane
  })
  return makeDieModel({ name: "d6", corners, faces, geometry: (_, size) => dieGeometry(size) })
}

function d8(): DieModel {
  const corners = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)]
  return makeDieModel({ name: "d8", corners, geometry: polyhedronGeometry })
}

/** The corners of a pentagonal trapezohedron: two points on the axis and two rings of five, one turned half a step from the other, at the height that makes each kite flat */
function d10(): DieModel {
  const apex = 1
  const ring = apex / (1 + (2 * Math.cos(Math.PI / 5)) / (1 - Math.cos(Math.PI / 5)))
  const corners = [new Vector3(0, apex, 0), new Vector3(0, -apex, 0)]
  for (let k = 0; k < 5; k++) {
    const upper = (k * 2 * Math.PI) / 5
    const lower = upper + Math.PI / 5
    corners.push(new Vector3(Math.cos(upper), ring, Math.sin(upper)), new Vector3(Math.cos(lower), -ring, Math.sin(lower)))
  }
  return makeDieModel({ name: "d10", corners, geometry: polyhedronGeometry })
}

function d12(): DieModel {
  const corners: Vector3[] = []
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push(new Vector3(x, y, z))
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      corners.push(new Vector3(0, a / PHI, b * PHI), new Vector3(a / PHI, b * PHI, 0), new Vector3(a * PHI, 0, b / PHI))
    }
  }
  return makeDieModel({ name: "d12", corners, geometry: polyhedronGeometry })
}

function d20(): DieModel {
  const corners: Vector3[] = []
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      corners.push(new Vector3(0, a, b * PHI), new Vector3(a, b * PHI, 0), new Vector3(a * PHI, 0, b))
    }
  }
  return makeDieModel({ name: "d20", corners, geometry: polyhedronGeometry })
}

const BUILDERS: Record<DieShape, () => DieModel> = { d6, d8, d10, d12, d20 }
const made = new Map<DieShape, DieModel>()

/** The model of one of the dice of the package: made the first time it is asked for, then kept. A game with a solid of its own makes it with `makeDieModel` and gives it to the `Die` as it is */
export function dieModel(shape: DieShape): DieModel {
  let model = made.get(shape)
  if (!model) {
    model = BUILDERS[shape]()
    made.set(shape, model)
  }
  return model
}
