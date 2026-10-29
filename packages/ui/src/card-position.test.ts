import { describe, expect, it } from "vitest"
import { cardPosition, type Box } from "./card-position"

const viewport = { width: 1440, height: 1000 }
const card = { width: 288, height: 250 }

describe("cardPosition", () => {
  it("puts a card to the left of what it is about, its top moved by the offset along it", () => {
    const row: Box = { left: 1098, top: 253, width: 286, height: 52 }
    expect(cardPosition(row, card, viewport, { side: "left", align: "start", offset: 1, alignOffset: -8 })).toEqual({ x: 1098 - 1 - 288, y: 245 })
  })

  it("lets a negative offset overlap what it is about", () => {
    const row: Box = { left: 1000, top: 300, width: 200, height: 40 }
    expect(cardPosition(row, card, viewport, { side: "left", align: "start", offset: -16 }).x).toBe(1000 + 16 - 288)
  })

  it("puts a card under what it is about, centred on it", () => {
    const pill: Box = { left: 1182, top: 34, width: 57, height: 40 }
    expect(cardPosition(pill, { width: 240, height: 100 }, viewport, { side: "bottom", align: "center", offset: 2 })).toEqual({ x: 1182 + 28.5 - 120, y: 76 })
  })

  it("stays in the window, moving along its edge", () => {
    const left: Box = { left: 100, top: 10, width: 50, height: 40 }
    expect(cardPosition(left, card, viewport, { side: "left", align: "start", offset: 0 })).toEqual({ x: 16, y: 16 })
    const low: Box = { left: 1000, top: 950, width: 100, height: 40 }
    expect(cardPosition(low, card, viewport, { side: "left", align: "start", offset: 0 }).y).toBe(1000 - 250 - 16)
    const right: Box = { left: 1400, top: 34, width: 40, height: 40 }
    expect(cardPosition(right, card, viewport, { side: "bottom", align: "center", offset: 0 }).x).toBe(1440 - 288 - 16)
  })

  it("starts a card taller than the window at the top", () => {
    const anchor: Box = { left: 700, top: 400, width: 100, height: 40 }
    expect(cardPosition(anchor, { width: 288, height: 1200 }, viewport, { side: "left", align: "start", offset: 0 }).y).toBe(16)
  })
})
