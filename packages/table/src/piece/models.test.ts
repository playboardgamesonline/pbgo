import { Box3, type BufferAttribute, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { makeFlatPiece, makePiece, PIECE_SHAPES, pieceModel } from "./models"
import { fitOutline, type Outline } from "./outline"
import { PIECE_FIELDS, PIECE_SETTINGS, PIECE_SIZE } from "./settings"
import { cubeGeometry } from "./geometry"

describe.each(PIECE_SHAPES)("the %s", (shape) => {
  const model = pieceModel(shape)

  it("stands on the table as tall as the model says, at any size", () => {
    for (const size of [0.5, 1, 3]) {
      const box = new Box3().setFromBufferAttribute(model.geometry(size).getAttribute("position") as BufferAttribute)
      expect(box.min.y, `${size}`).toBeCloseTo(0, 6)
      expect(box.max.y, `${size}`).toBeCloseTo(model.height * size, 5)
    }
  })

  it("fits the circle the model says, on the table", () => {
    const position = model.geometry(1).getAttribute("position")
    let farthest = 0
    for (let i = 0; i < position.count; i++) farthest = Math.max(farthest, Math.hypot(position.getX(i), position.getZ(i)))
    expect(farthest).toBeCloseTo(model.reach, 2)
  })

  it("has the material groups its kind has: an edge, a top and a bottom for a flat piece, one for any other", () => {
    const groups = model.geometry(1).groups.map((g) => g.materialIndex)
    expect(groups).toEqual(model.flat ? [0, 1, 2] : [0])
  })

  it("has the colour attribute that lights it as it turns, and a geometry of its own each time", () => {
    const a = model.geometry(1)
    expect(a.getAttribute("color").count).toBe(a.getAttribute("position").count)
    expect(model.geometry(1)).not.toBe(a)
  })
})

describe("pieceModel", () => {
  it("makes a model once and gives it again", () => {
    expect(pieceModel("hex")).toBe(pieceModel("hex"))
  })

  it("has flat pieces that turn over and solids that do not", () => {
    expect(PIECE_SHAPES.filter((s) => pieceModel(s).flat)).toEqual(["disc", "square", "hex"])
  })

  it("has tokens thinner than tiles are wide, and solids as tall as they are wide or more", () => {
    expect(pieceModel("disc").height).toBeLessThan(0.3)
    expect(pieceModel("cube").height).toBe(1)
    expect(pieceModel("pawn").height).toBeGreaterThan(1)
  })
})

describe("makeFlatPiece", () => {
  const meeple: Outline = fitOutline([
    [0, 0],
    [4, 0],
    [4, 6],
    [6, 7],
    [8, 12],
    [5, 11],
    [4, 16],
    [0, 16],
    [-1, 11],
    [-4, 12],
    [-2, 7],
    [0, 6],
  ])

  it("makes a flat piece of any silhouette, as thick as asked", () => {
    const model = makeFlatPiece({ name: "meeple", outline: meeple, height: 0.2 })
    expect(model.flat).toBe(true)
    expect(model.height).toBe(0.2)
    const box = new Box3().setFromBufferAttribute(model.geometry(2).getAttribute("position") as BufferAttribute)
    expect(box.max.y).toBeCloseTo(0.4, 6)
    expect(box.max.z - box.min.z).toBeCloseTo(2, 5)
    expect(model.reach).toBeGreaterThan(0.3)
  })

  it("is 0.12 thick unless told", () => {
    expect(makeFlatPiece({ name: "x", outline: meeple }).height).toBe(0.12)
  })
})

describe("makePiece", () => {
  it("makes a piece of a solid of the game's own, with one material unless it is flat", () => {
    const model = makePiece({ name: "block", height: 1, reach: 0.71, geometry: cubeGeometry })
    expect(model.flat).toBe(false)
    expect(model.geometry(1).groups).toHaveLength(1)
    expect(new Vector3(model.reach, 0, 0).length()).toBe(0.71)
  })
})

describe("the settings of a piece", () => {
  it("has a knob for each setting", () => {
    expect(Object.keys(PIECE_FIELDS).sort()).toEqual(Object.keys(PIECE_SETTINGS).sort())
  })

  it("has a size smaller than a card", () => {
    expect(PIECE_SIZE).toBeLessThan(1.3)
  })
})
