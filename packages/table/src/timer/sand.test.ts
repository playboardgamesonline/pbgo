import { describe, expect, it } from "vitest"
import { dangerAt, FLOOR, NECK, PILE_HEIGHT, PILE_WIDEST, sandAt, secondsLeft, TOP_REACH, TOP_RADIUS, shareLeft } from "./sand"
import { GLASS_PROFILE } from "./geometry"

describe("what is left of the time", () => {
  it("is all of it at the start and none at the end, on one clock", () => {
    expect(shareLeft(11_000, 1_000, 10)).toBe(1)
    expect(shareLeft(11_000, 6_000, 10)).toBe(0.5)
    expect(shareLeft(11_000, 11_000, 10)).toBe(0)
    expect(shareLeft(11_000, 99_000, 10)).toBe(0)
    expect(shareLeft(11_000, -5_000, 10)).toBe(1)
  })

  it("is what is given when no clock runs, kept between none and all", () => {
    expect(shareLeft(null, 5_000, 10)).toBe(1)
    expect(shareLeft(null, 5_000, 10, 0.25)).toBe(0.25)
    expect(shareLeft(null, 5_000, 10, 3)).toBe(1)
    expect(shareLeft(null, 5_000, 10, -1)).toBe(0)
  })

  it("is none for a length that is not above zero", () => {
    expect(shareLeft(1_000, 0, 0)).toBe(0)
    expect(shareLeft(null, 0, -4)).toBe(0)
    expect(shareLeft(1_000, 0, Number.NaN)).toBe(0)
  })

  it("counts the seconds up, so that a timer says 1 until it is out", () => {
    expect(secondsLeft(1, 10)).toBe(10)
    expect(secondsLeft(0.95, 10)).toBe(10)
    expect(secondsLeft(0.9, 10)).toBe(9)
    expect(secondsLeft(0.05, 10)).toBe(1)
    expect(secondsLeft(0.0001, 10)).toBe(1)
    expect(secondsLeft(0, 10)).toBe(0)
  })
})

describe("the sand", () => {
  it("fills the top bulb at the start and the bottom bulb at the end", () => {
    const start = sandAt(1, true)
    expect(start.top.height).toBeCloseTo(TOP_REACH, 10)
    expect(start.top.radius).toBeCloseTo(TOP_RADIUS, 10)
    expect(start.bottom.height).toBe(0)
    const end = sandAt(0, false)
    expect(end.top.height).toBe(0)
    expect(end.bottom.height).toBeCloseTo(PILE_HEIGHT, 10)
    expect(end.bottom.radius).toBeLessThanOrEqual(PILE_WIDEST)
  })

  it("moves from the top to the bottom as the time goes", () => {
    let top = Infinity
    let bottom = -Infinity
    for (let left = 1; left >= 0; left -= 0.05) {
      const sand = sandAt(left, true)
      expect(sand.top.height).toBeLessThanOrEqual(top + 1e-12)
      expect(sand.bottom.height).toBeGreaterThanOrEqual(bottom - 1e-12)
      top = sand.top.height
      bottom = sand.bottom.height
    }
  })

  it("empties the top slowly at first and quicker at the end, the volume of a cone being the cube of its height", () => {
    // Half the time gone leaves a cone of half the volume: a height of the cube root of a half
    expect(sandAt(0.5, true).top.height / TOP_REACH).toBeCloseTo(Math.cbrt(0.5), 10)
    const early = sandAt(1, true).top.height - sandAt(0.9, true).top.height
    const late = sandAt(0.1, true).top.height - sandAt(0, true).top.height
    expect(late).toBeGreaterThan(early * 5)
  })

  it("stays inside the glass: the top above the neck and under the dome, the pile on the floor", () => {
    const widest = Math.max(...GLASS_PROFILE.map(([radius]) => radius))
    for (let left = 0; left <= 1; left += 0.1) {
      const sand = sandAt(left, true)
      expect(NECK + sand.top.height).toBeLessThan(0.925)
      expect(sand.top.radius).toBeLessThan(widest)
      expect(FLOOR + sand.bottom.height).toBeLessThan(NECK)
      expect(sand.bottom.radius).toBeLessThan(widest)
    }
  })

  it("lets a thin stream fall only while the clock runs and there is sand in the top", () => {
    expect(sandAt(0.5, true).falling).toBe(true)
    expect(sandAt(0.5, false).falling).toBe(false)
    expect(sandAt(0, true).falling).toBe(false)
    expect(sandAt(1, false).falling).toBe(false)
  })
})

describe("the warning", () => {
  it("does not begin before `warn` seconds are left", () => {
    expect(dangerAt(1, 10, 5)).toBe(0)
    expect(dangerAt(0.5, 10, 5)).toBe(0)
    expect(dangerAt(0.51, 10, 5)).toBe(0)
  })

  it("grows from nothing to everything over the last `warn` seconds", () => {
    expect(dangerAt(0.25, 10, 5)).toBeCloseTo(0.5, 10)
    expect(dangerAt(0, 10, 5)).toBe(1)
    expect(dangerAt(0.4, 10, 5)).toBeLessThan(dangerAt(0.3, 10, 5))
  })

  it("is for a whole step that is shorter than the warning", () => {
    expect(dangerAt(1, 3, 5)).toBeCloseTo(1 - 3 / 5, 10)
  })

  it("is none when the warning is off or the step has no length", () => {
    expect(dangerAt(0, 10, 0)).toBe(0)
    expect(dangerAt(0, 0, 5)).toBe(0)
  })
})
