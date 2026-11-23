import { describe, expect, it } from "vitest"
import { reachAlong } from "../floor/label-look"
import { RESTING_HEIGHT } from "../pose"
import { PILE_LABEL_GAP, pileAboveAt, pileFootprint, pileLabelAt } from "./pile-label"

const CARD = { width: 1.2, height: 1.7 }

describe("where the count of a pile is written", () => {
  it("is under the pile for the viewer, centred on it, a gap past its edge", () => {
    expect(pileLabelAt({ x: -3, z: 0.5 }, CARD)).toEqual({ x: -3, z: 0.5 + CARD.height / 2 + PILE_LABEL_GAP })
  })

  it("is the middle of the table's front when the pile has no frame", () => {
    expect(pileLabelAt(undefined, CARD)).toEqual({ x: 0, z: CARD.height / 2 + PILE_LABEL_GAP })
  })

  it("keeps clear of a pile that is turned: its half width for a quarter turn, the same for a half turn as for none", () => {
    expect(pileLabelAt({ x: 0, z: 0, yaw: Math.PI / 2 }, CARD).z).toBeCloseTo(CARD.width / 2 + PILE_LABEL_GAP)
    expect(pileLabelAt({ x: 0, z: 0, yaw: Math.PI }, CARD).z).toBeCloseTo(CARD.height / 2 + PILE_LABEL_GAP)
  })

  it("takes the scale of the cards of the pile", () => {
    expect(pileLabelAt({ x: 0, z: 0 }, CARD, 0.5).z).toBeCloseTo((CARD.height * 0.5) / 2 + PILE_LABEL_GAP)
  })

  it("never lies over the pile whatever way it is turned", () => {
    for (let turn = 0; turn < 16; turn++) {
      const yaw = (turn * Math.PI) / 8
      // the corners of the card, turned: the farthest toward the viewer is the pile's edge
      const corners = [
        [-CARD.width / 2, -CARD.height / 2],
        [CARD.width / 2, -CARD.height / 2],
        [-CARD.width / 2, CARD.height / 2],
        [CARD.width / 2, CARD.height / 2],
      ]
      const edge = Math.max(...corners.map(([x, z]) => x! * Math.sin(yaw) + z! * Math.cos(yaw)))
      expect(pileLabelAt({ x: 0, z: 0, yaw }, CARD).z).toBeGreaterThanOrEqual(edge + PILE_LABEL_GAP - 1e-9)
    }
  })
})

describe("where the action label over a pile stands", () => {
  it("is the middle of the pile, so the label is centred on it", () => {
    expect(pileAboveAt({ x: -3, z: 0.5 })).toEqual({ x: -3, y: RESTING_HEIGHT, z: 0.5 })
  })

  it("is the middle of the table when the pile has no frame", () => {
    expect(pileAboveAt(undefined)).toEqual({ x: 0, y: RESTING_HEIGHT, z: 0 })
  })

  it("is at the height of the top of the pile that is given, the table's when none is", () => {
    expect(pileAboveAt({ x: 0, z: 0 }, 0.29).y).toBe(0.29)
    expect(pileAboveAt({ x: 0, z: 0 }).y).toBe(RESTING_HEIGHT)
  })
})

describe("the room a pile takes, which the action label keeps clear of", () => {
  it("is the width and the depth of its cards, at the scale of the pile", () => {
    expect(pileFootprint({ x: 0, z: 0 }, CARD)).toEqual({ width: CARD.width, depth: CARD.height, yaw: 0 })
    expect(pileFootprint({ x: 0, z: 0 }, CARD, 0.5)).toEqual({ width: CARD.width * 0.5, depth: CARD.height * 0.5, yaw: 0 })
  })

  it("is turned as the pile's frame turns it, and not at all when the pile has no frame", () => {
    expect(pileFootprint({ x: 1, z: 2, yaw: 1.2 }, CARD).yaw).toBe(1.2)
    expect(pileFootprint(undefined, CARD).yaw).toBe(0)
  })

  it("reaches away from the viewer as far as the count is under the pile, less the count's gap, whatever way the pile is turned", () => {
    for (let turn = 0; turn < 16; turn++) {
      const frame = { x: 1, z: 2, yaw: (turn * Math.PI) / 8 }
      const under = pileLabelAt(frame, CARD, 0.8).z - frame.z - PILE_LABEL_GAP
      expect(reachAlong(pileFootprint(frame, CARD, 0.8), 0, -1)).toBeCloseTo(under)
    }
  })
})
