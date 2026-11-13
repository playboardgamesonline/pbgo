import { describe, expect, it } from "vitest"
import { fitLabel, floorColours, isHex, LIFT_LEVELS, liftTarget, mix, padRadius, rimThickness, stepLift } from "./lift"

const idle = { hovered: false, focused: false, pressed: false, disabled: false }

describe("liftTarget", () => {
  it("is flat at rest and raised under the pointer or the keyboard focus", () => {
    expect(liftTarget(idle)).toBe(LIFT_LEVELS.rest)
    expect(liftTarget({ ...idle, hovered: true })).toBe(LIFT_LEVELS.raised)
    expect(liftTarget({ ...idle, focused: true })).toBe(LIFT_LEVELS.raised)
  })
  it("presses the rim down a little while it is held, below raised and above flat", () => {
    const pressed = liftTarget({ ...idle, hovered: true, pressed: true })
    expect(pressed).toBeLessThan(LIFT_LEVELS.raised)
    expect(pressed).toBeGreaterThan(LIFT_LEVELS.rest)
  })
  it("never lifts a disabled button, whatever the pointer does", () => {
    expect(liftTarget({ hovered: true, focused: true, pressed: true, disabled: true })).toBe(0)
  })
})

describe("stepLift", () => {
  it("is the target at once under reduced motion", () => {
    expect(stepLift(0, 1, 0.016, true)).toBe(1)
    expect(stepLift(1, 0, 0.016, true)).toBe(0)
  })
  it("goes toward the target without passing it, and settles on it", () => {
    let lift = 0
    let last = 0
    for (let i = 0; i < 120; i++) {
      lift = stepLift(lift, 1, 1 / 60, false)
      expect(lift).toBeGreaterThanOrEqual(last)
      expect(lift).toBeLessThanOrEqual(1)
      last = lift
    }
    expect(lift).toBe(1)
  })
  it("is on its way after one frame, not there", () => {
    const one = stepLift(0, 1, 1 / 60, false)
    expect(one).toBeGreaterThan(0)
    expect(one).toBeLessThan(1)
  })
  it("stays where it is when no time passes", () => {
    expect(stepLift(0.3, 1, 0, false)).toBe(0.3)
  })
})

describe("colours", () => {
  it("mixes two colours", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080")
    expect(mix("#102030", "#102030", 0.7)).toBe("#102030")
  })
  it("knows a #rrggbb colour", () => {
    expect(isHex("#1a2B3c")).toBe(true)
    expect(isHex("teal")).toBe(false)
    expect(isHex("#fff")).toBe(false)
  })
  it("brightens the fill and fills it in as the rim lifts", () => {
    const rest = floorColours("#2a9d8f", 0)
    const up = floorColours("#2a9d8f", 1)
    expect(up.fillOpacity).toBeGreaterThan(rest.fillOpacity)
    expect(up.rimTop).not.toBe(rest.rimTop)
    expect(rest.rimSide).not.toBe(rest.rimTop)
  })
  it("dims a disabled button", () => {
    expect(floorColours("#2a9d8f", 0, true).fillOpacity).toBeLessThan(floorColours("#2a9d8f", 0).fillOpacity)
  })
  it("clamps a lift outside 0 to 1", () => {
    expect(floorColours("#2a9d8f", 5)).toEqual(floorColours("#2a9d8f", 1))
    expect(floorColours("#2a9d8f", -1)).toEqual(floorColours("#2a9d8f", 0))
  })
})

describe("fitLabel", () => {
  it("keeps the height asked for when the text fits, and shrinks a long one to the width", () => {
    expect(fitLabel("HIT", 2, 0.5)).toBe(0.5)
    expect(fitLabel("Pedir carta ahora mismo", 1.5, 0.5)).toBeLessThan(0.5)
    expect(fitLabel("", 2, 0.5)).toBe(0.5)
  })
  it("counts characters, not UTF-16 units", () => {
    expect(fitLabel("😀😀😀", 4, 0.5)).toBe(fitLabel("abc", 4, 0.5))
  })
  it("never goes to nothing for a pad with no room", () => {
    expect(fitLabel("Stay", 0, 0.5)).toBeGreaterThan(0)
  })
})

describe("the shape of a pad", () => {
  it("has a thin outline that never swallows a small pad", () => {
    expect(rimThickness(10, 10)).toBeLessThanOrEqual(0.09)
    expect(rimThickness(1, 0.5)).toBeLessThan(0.5 / 2)
  })
  it("rounds a pad by its short side", () => {
    expect(padRadius(4, 1)).toBeCloseTo(0.18)
    expect(padRadius(20, 20)).toBe(0.35)
  })
})
