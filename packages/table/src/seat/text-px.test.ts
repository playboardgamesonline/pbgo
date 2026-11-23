import { describe, expect, it } from "vitest"
import { fitScale, TEXT_PX } from "./text-px"

describe("fitScale", () => {
  it("leaves a text that fits as it is", () => {
    // a text painted 155 canvas pixels wide at a height of 1 is 1 world unit wide
    expect(fitScale(TEXT_PX, 1, 3)).toBe(1)
    expect(fitScale(TEXT_PX, 1, 1)).toBe(1)
  })

  it("keeps to no room when it is given none or an unusable one", () => {
    expect(fitScale(TEXT_PX * 10, 1)).toBe(1)
    expect(fitScale(TEXT_PX * 10, 1, 0)).toBe(1)
    expect(fitScale(TEXT_PX * 10, 1, -2)).toBe(1)
    expect(fitScale(TEXT_PX * 10, 1, Number.NaN)).toBe(1)
  })

  it("shrinks a text that is wider than its room until it is exactly as wide as the room", () => {
    // 620 pixels at a height of 0.5 are 2 world units wide: 1 unit of room halves them
    const scale = fitScale(620, 0.5, 1)
    expect(scale).toBeCloseTo(0.5, 10)
    expect((620 * 0.5 * scale) / TEXT_PX).toBeCloseTo(1, 10)
  })

  it("shrinks a taller lettering of the same words more, since it is wider", () => {
    expect(fitScale(620, 1, 1)).toBeLessThan(fitScale(620, 0.5, 1))
  })

  it("has nothing to shrink in an empty text", () => {
    expect(fitScale(0, 0.55, 3)).toBe(1)
  })
})
