import { describe, expect, it } from "vitest"
import { GLIDE_RATE, glideStep } from "./glide-step"

describe("how a group glides to its place", () => {
  it("stays where it is when it is there already", () => {
    expect(glideStep(2, 2, 0.016, false)).toBe(2)
    expect(glideStep(-0.75, -0.75, 1, false)).toBe(-0.75)
  })

  it("closes on the target and never goes past it, from either side", () => {
    for (const [from, to] of [
      [0, 0.75],
      [0.75, 0],
      [-2, 3],
      [3, -2],
    ] as const) {
      let at: number = from
      for (let frame = 0; frame < 400; frame++) {
        const next = glideStep(at, to, 1 / 60, false)
        // no overshoot: it is never farther from the target than it was, nor on the other side of it
        expect(Math.abs(to - next)).toBeLessThanOrEqual(Math.abs(to - at) + 1e-12)
        expect((next - to) * (from - to)).toBeGreaterThanOrEqual(0)
        at = next
      }
      expect(at).toBe(to)
    }
  })

  it("covers about 95 % of the way in under half a second", () => {
    const left = Math.abs(1 - glideStep(0, 1, 0.45, false))
    expect(left).toBeLessThan(0.05)
    expect(left).toBeGreaterThan(0)
    expect(Math.log(20) / GLIDE_RATE).toBeLessThan(0.5)
  })

  it("covers the same way in the same time at any frame rate", () => {
    let slow = 0
    for (let frame = 0; frame < 15; frame++) slow = glideStep(slow, 1, 1 / 30, false)
    let fast = 0
    for (let frame = 0; frame < 60; frame++) fast = glideStep(fast, 1, 1 / 120, false)
    const once = glideStep(0, 1, 0.5, false)
    expect(slow).toBeCloseTo(fast, 6)
    expect(slow).toBeCloseTo(once, 6)
  })

  it("lands exactly on its place, once it is within a thousandth of it", () => {
    expect(glideStep(0.9995, 1, 0.016, false)).toBe(1)
    expect(glideStep(0, 1, 0.016, false)).toBeLessThan(1)
  })

  it("does not move when no time has passed, nor when time runs backwards", () => {
    expect(glideStep(0, 1, 0, false)).toBe(0)
    expect(glideStep(0, 1, -1, false)).toBe(0)
  })

  it("is in its place at once with reduced motion, whatever the distance and the time", () => {
    expect(glideStep(0, 0.75, 0.016, true)).toBe(0.75)
    expect(glideStep(-3, 4, 0, true)).toBe(4)
  })

  it("covers more of a long way than of a short one in the same time, and the same share of both", () => {
    const far = glideStep(0, 4, 0.1, false)
    const near = glideStep(0, 1, 0.1, false)
    expect(far).toBeGreaterThan(near)
    expect(far / 4).toBeCloseTo(near / 1, 9)
  })
})
