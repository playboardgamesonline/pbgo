import { describe, expect, it } from "vitest"
import { labelFace, newLabels, turnLabels } from "./labels"
import { makeDieModel } from "./model"
import { DIE_SHAPES, dieModel } from "./solids"
import { polyhedronGeometry } from "./geometry"
import { Vector3 } from "three"

describe.each(DIE_SHAPES)("labelling the %s", (shape) => {
  const model = dieModel(shape)
  const start = newLabels(model)

  it("puts any label on any face, for every face and every label", () => {
    for (let face = 0; face < model.sides; face++) {
      for (let label = 0; label < model.sides; label++) {
        const labels = labelFace(model, start, face, label, `k:${face}:${label}`)
        expect(labels[face], `${label} on ${face}`).toBe(label)
        expect([...labels].sort((a, b) => a - b)).toEqual(model.faces.map((_, i) => i))
      }
    }
  })

  it("leaves a proper die: opposite faces still add up to the same number", () => {
    for (let face = 0; face < model.sides; face++) {
      const labels = labelFace(model, start, face, (face * 7 + 3) % model.sides, `p:${face}`)
      model.faces.forEach((_, f) => expect(labels[f]! + labels[model.opposite[f]!]!).toBe(model.sides - 1))
    }
  })

  it("is the same for the same key and may differ for another when the die has several ways", () => {
    expect(labelFace(model, start, 1, 0, "same")).toEqual(labelFace(model, start, 1, 0, "same"))
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) seen.add(labelFace(model, start, 1, 0, `key-${i}`).join(","))
    // A solid with one turn for each face (the d10) has one way only, the others have several
    if (model.symmetries.length > model.sides) expect(seen.size).toBeGreaterThan(1)
    else expect(seen.size).toBe(1)
  })

  it("keeps what was labelled when it is labelled again, whatever came before", () => {
    let labels: readonly number[] = start
    for (let i = 0; i < 30; i++) {
      const face = (i * 5) % model.sides
      const label = (i * 3 + 1) % model.sides
      labels = labelFace(model, labels, face, label, `again:${i}`)
      expect(labels[face]).toBe(label)
      model.faces.forEach((_, f) => expect(labels[f]! + labels[model.opposite[f]!]!).toBe(model.sides - 1))
    }
  })

  it("leaves the die alone when the face already carries the label", () => {
    expect(labelFace(model, start, 2, start[2]!, "x")).toEqual([...start])
  })
})

describe("turnLabels", () => {
  it("moves the label of each face to the face the turn takes it to", () => {
    expect(turnLabels([0, 1, 2, 3], [1, 0, 3, 2])).toEqual([1, 0, 3, 2])
    expect(turnLabels([5, 6, 7], [2, 0, 1])).toEqual([6, 7, 5])
  })
})

describe("a die with no turn onto itself", () => {
  // A triangular prism's two ends and three sides: made by hand, so that the model knows no symmetry but the identity
  const corners = [new Vector3(0, 1, 0), new Vector3(0.9, -0.5, 0.2), new Vector3(-0.8, -0.5, -0.1), new Vector3(0.1, 0.9, 0.9), new Vector3(0.8, -0.6, 1.1), new Vector3(-0.7, -0.4, 1.2)]
  const model = makeDieModel({ name: "odd", corners, geometry: polyhedronGeometry })

  it("swaps the two labels instead", () => {
    const labels = labelFace(model, newLabels(model), 0, model.sides - 1, "odd")
    expect(labels[0]).toBe(model.sides - 1)
    expect([...labels].sort((a, b) => a - b)).toEqual(model.faces.map((_, i) => i))
  })

  it("refuses a label the die does not have", () => {
    expect(() => labelFace(model, newLabels(model), 0, 99, "odd")).toThrow(RangeError)
  })
})
