import { describe, expect, it } from "vitest"
import { PILE_LABEL_GAP, pileLabelAt } from "./pile-label"

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
