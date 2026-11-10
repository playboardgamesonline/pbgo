import { Quaternion, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { hullFaces } from "./hull"
import { dropOf, faceUpQuaternion, restingQuaternion, upFaceOf } from "./model"
import { DIE_SHAPES, dieModel, type DieShape } from "./solids"

const SIDES: Record<DieShape, number> = { d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 }
const CORNERS: Record<DieShape, number> = { d6: 4, d8: 3, d10: 4, d12: 5, d20: 3 }
const TURNS: Record<DieShape, number> = { d6: 24, d8: 24, d10: 10, d12: 60, d20: 60 }

describe("hullFaces", () => {
  it("finds the six faces of a cube and orders the corners of each counterclockwise seen from outside", () => {
    const cube: Vector3[] = []
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cube.push(new Vector3(x, y, z))
    const faces = hullFaces(cube)
    expect(faces).toHaveLength(6)
    for (const face of faces) {
      expect(face.corners).toHaveLength(4)
      const [a, b, c] = face.corners.map((i) => cube[i]!) as [Vector3, Vector3, Vector3]
      expect(b.clone().sub(a).cross(c.clone().sub(a)).dot(face.normal)).toBeGreaterThan(0)
      expect(face.distance).toBeCloseTo(1, 9)
    }
  })

  it("leaves out a point inside the solid", () => {
    const points = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1), new Vector3(0, 0, 0)]
    expect(hullFaces(points)).toHaveLength(8)
  })
})

describe.each(DIE_SHAPES)("the %s", (shape) => {
  const model = dieModel(shape)

  it("has the faces of its kind, each a flat polygon looking out", () => {
    expect(model.sides).toBe(SIDES[shape])
    expect(model.faces).toHaveLength(SIDES[shape])
    for (const face of model.faces) {
      expect(face.normal.length()).toBeCloseTo(1, 9)
      expect(face.corners).toHaveLength(CORNERS[shape])
      const [a, b, c] = face.corners as [Vector3, Vector3, Vector3]
      expect(b.clone().sub(a).cross(c.clone().sub(a)).dot(face.normal)).toBeGreaterThan(0)
      for (const corner of face.corners) expect(corner.dot(face.normal)).toBeCloseTo(face.inradius, 6)
      expect(face.centre.distanceTo(face.normal.clone().multiplyScalar(face.inradius))).toBeLessThan(1e-9)
    }
    expect(new Set(model.faces.map((face) => face.normal.toArray().map((n) => n.toFixed(4)).join(","))).size).toBe(SIDES[shape])
  })

  it("is one unit across two opposite faces", () => {
    for (const face of model.faces) expect(face.inradius).toBeCloseTo(0.5, 6)
  })

  it("is convex: no corner is past the plane of a face", () => {
    for (const face of model.faces) for (const corner of model.hull) expect(corner.dot(face.normal)).toBeLessThanOrEqual(face.inradius + 1e-6)
  })

  it("has a face on the far side of each face", () => {
    model.faces.forEach((face, f) => {
      const other = model.opposite[f]!
      expect(other).toBeGreaterThanOrEqual(0)
      expect(model.opposite[other]).toBe(f)
      expect(face.normal.clone().add(model.faces[other]!.normal).length()).toBeLessThan(1e-6)
    })
  })

  it("is labelled with every number once, opposite faces adding up to the greatest", () => {
    expect([...model.labels].sort((a, b) => a - b)).toEqual(Array.from({ length: SIDES[shape] }, (_, i) => i))
    model.faces.forEach((_, f) => expect(model.labels[f]! + model.labels[model.opposite[f]!]!).toBe(SIDES[shape] - 1))
  })

  it("turns onto itself in as many ways as its kind does, the first being no turn at all", () => {
    expect(model.symmetries).toHaveLength(TURNS[shape])
    expect(model.symmetries[0]).toEqual(model.faces.map((_, i) => i))
  })

  it("keeps the faces that are opposite opposite under every turn", () => {
    for (const turn of model.symmetries) {
      expect([...turn].sort((a, b) => a - b)).toEqual(model.faces.map((_, i) => i))
      model.faces.forEach((_, f) => expect(model.opposite[turn[f]!]).toBe(turn[model.opposite[f]!]))
    }
  })

  it("can be turned so that any face lands on any other: a roll can end on any number", () => {
    for (let from = 0; from < model.sides; from++) {
      for (let to = 0; to < model.sides; to++) expect(model.symmetries.some((turn) => turn[from] === to), `${from} to ${to}`).toBe(true)
    }
  })

  it("is closed under turning twice", () => {
    const known = new Set(model.symmetries.map((turn) => turn.join(",")))
    for (const a of model.symmetries.slice(0, 12)) {
      for (const b of model.symmetries.slice(0, 12)) expect(known.has(a.map((f) => b[f]!).join(","))).toBe(true)
    }
  })

  it("lies flat on a face when that face's opposite is up, and reaches no lower than half its width", () => {
    model.faces.forEach((_, f) => {
      const q = restingQuaternion(model, f, 0.6)
      expect(dropOf(model, q)).toBeCloseTo(0.5, 6)
      const up = upFaceOf(model, q)
      expect(up.face).toBe(f)
      expect(up.flatness).toBeCloseTo(1, 9)
    })
    for (let i = 0; i < 100; i++) {
      const q = new Quaternion(Math.sin(i * 1.7), Math.cos(i * 2.3), Math.sin(i * 0.9 + 1), Math.cos(i * 3.1)).normalize()
      expect(dropOf(model, q)).toBeGreaterThanOrEqual(0.5 - 1e-9)
    }
  })

  it("is drawn with a group for every face, each face looking out and flat", () => {
    const geometry = model.geometry(2)
    const position = geometry.getAttribute("position")
    const index = geometry.getIndex()!
    const faces = geometry.groups.filter((g) => g.count > 0 && g.materialIndex! > 0)
    expect(faces.map((g) => g.materialIndex).sort((a, b) => a! - b!)).toEqual(Array.from({ length: SIDES[shape] }, (_, i) => i + 1))
    for (const group of faces) {
      const face = model.faces[group.materialIndex! - 1]!
      for (let t = group.start; t < group.start + group.count; t++) {
        const p = new Vector3(position.getX(index.getX(t)), position.getY(index.getX(t)), position.getZ(index.getX(t)))
        expect(p.dot(face.normal)).toBeCloseTo(face.inradius * 2, 5)
      }
    }
  })

  it("brings a face to the top with a turn that moves nothing else out of place", () => {
    model.faces.forEach((face, f) => expect(face.normal.clone().applyQuaternion(faceUpQuaternion(model, f)).distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-9))
  })
})

describe("the d6", () => {
  const model = dieModel("d6")

  it("is the cube with its corners cut, on the faces numbers go in: 1 up, 2 toward the viewer, 3 to the right", () => {
    expect(model.faces[0]!.normal.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-9)
    expect(model.faces[1]!.normal.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-9)
    expect(model.faces[2]!.normal.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-9)
    expect(model.labels).toEqual([0, 1, 2, 3, 4, 5])
    expect(model.hull).toHaveLength(24)
  })
})

describe("the d10", () => {
  it("has kites that are flat: the four corners of each lie in one plane", () => {
    const model = dieModel("d10")
    for (const face of model.faces) for (const corner of face.corners) expect(Math.abs(corner.dot(face.normal) - face.inradius)).toBeLessThan(1e-6)
  })
})

describe("dieModel", () => {
  it("makes a model once and gives it again", () => {
    expect(dieModel("d20")).toBe(dieModel("d20"))
  })
})
