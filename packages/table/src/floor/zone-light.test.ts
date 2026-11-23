import { Color } from "three"
import { describe, expect, it } from "vitest"
import { AURA, AURA_FIELDS, AURA_LOOK, AURA_SHAPE, auraPlane, BAND, bandTarget, tint } from "./zone-light"

describe("how big an aura is", () => {
  it("is the zone, bigger by the reach of the glow on every side", () => {
    expect(auraPlane({ width: 6, depth: 2.4 })).toEqual({ width: 6 + 2 * AURA_SHAPE.reach, depth: 2.4 + 2 * AURA_SHAPE.reach })
    expect(auraPlane({ width: 6, depth: 2.4 }, 1)).toEqual({ width: 8, depth: 4.4 })
  })

  it("keeps its rim inside the plane: the glow has room to fade out before the edge", () => {
    expect(AURA_SHAPE.reach).toBeGreaterThan(AURA_SHAPE.inset)
    expect(AURA_SHAPE.radius).toBeGreaterThan(0)
  })
})

describe("the look of an aura", () => {
  it("has a knob for each of its settings, and each default is inside its knob's range", () => {
    expect(Object.keys(AURA_FIELDS).sort()).toEqual(Object.keys(AURA_LOOK).sort())
    for (const [key, [, min, max]] of Object.entries(AURA_FIELDS)) {
      const value = AURA_LOOK[key as keyof typeof AURA_LOOK]
      expect(value).toBeGreaterThanOrEqual(min)
      expect(value).toBeLessThanOrEqual(max)
    }
  })

  it("is not drawn at all below a strength nobody can see, and settles in a fraction of a second", () => {
    expect(AURA.hidden).toBeLessThan(0.05)
    expect(AURA.settle).toBeGreaterThan(0)
    expect(AURA.settle).toBeLessThan(1)
  })
})

describe("how strong a band is aimed to be", () => {
  it("swells and dims about its strength by a share of it, never above or below that", () => {
    const strength = 2
    const targets = Array.from({ length: 400 }, (_, i) => bandTarget(strength, i * 0.03))
    expect(Math.max(...targets)).toBeCloseTo(strength * (1 + BAND.pulse), 1)
    expect(Math.min(...targets)).toBeCloseTo(strength * (1 - BAND.pulse), 1)
  })

  it("is its strength itself where the pulse is nothing, and with reduced motion", () => {
    expect(bandTarget(0.7, 1.3, { pulse: 0 })).toBe(0.7)
    for (const time of [0, 0.4, 2.2]) expect(bandTarget(0.7, time, { pulse: 0.5 }, true)).toBe(0.7)
  })

  it("takes the pulse and the speed a game gives", () => {
    // a quarter of a swing at a speed of 2 radians a second
    const time = Math.PI / 4
    expect(bandTarget(1, time, { pulse: 0.5, speed: 2 })).toBeCloseTo(1.5)
  })

  it("is nothing for a strength of nothing, whatever it does", () => {
    for (const time of [0, 1, 7]) expect(bandTarget(0, time)).toBe(0)
  })
})

describe("setting a colour only when it changed", () => {
  it("sets it the first time and again for another colour", () => {
    const color = new Color()
    tint(color, "#ff0000")
    expect(color.getHexString()).toBe("ff0000")
    tint(color, "#00ff00")
    expect(color.getHexString()).toBe("00ff00")
  })

  it("leaves what was set elsewhere alone while the text is the same", () => {
    const color = new Color()
    tint(color, "#ff0000")
    color.set("#0000ff")
    tint(color, "#ff0000")
    // the same text as the last, so nothing was parsed again
    expect(color.getHexString()).toBe("0000ff")
  })
})
