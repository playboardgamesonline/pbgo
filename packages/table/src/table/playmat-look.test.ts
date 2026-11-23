import { describe, expect, it } from "vitest"
import { BLENDS } from "./mat"
import { BLEND_GLSL, BLEND_INDEX, blendChannel, PLAYMAT, rollerAt, unrollClock, unrollProgress } from "./playmat-look"

describe("how far a playmat has rolled out", () => {
  it("has not begun until its delay has passed, and is all out once its duration has", () => {
    expect(unrollProgress(0)).toBe(0)
    expect(unrollProgress(PLAYMAT.delay)).toBe(0)
    expect(unrollProgress(PLAYMAT.delay + PLAYMAT.duration)).toBe(1)
    expect(unrollProgress(1000)).toBe(1)
    expect(unrollProgress(-3)).toBe(0)
  })

  it("only ever goes forward, and goes fast at first and slows as it settles", () => {
    const steps = Array.from({ length: 41 }, (_, i) => unrollProgress(PLAYMAT.delay + (i / 40) * PLAYMAT.duration))
    for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeGreaterThanOrEqual(steps[i - 1]!)
    // half way through its time it is well past half way out
    expect(steps[20]!).toBeGreaterThan(0.8)
    // the first quarter of its time covers more than the last quarter
    expect(steps[10]! - steps[0]!).toBeGreaterThan(steps[40]! - steps[30]!)
  })

  it("takes the delay and the duration a game gives", () => {
    expect(unrollProgress(1, { delay: 1, duration: 4 })).toBe(0)
    expect(unrollProgress(5, { delay: 1, duration: 4 })).toBe(1)
    expect(unrollProgress(3, { delay: 1, duration: 4 })).toBeCloseTo(0.875)
  })

  it("is all out at once for a duration of nothing, and never divides by it", () => {
    expect(unrollProgress(0.2, { delay: 0.1, duration: 0 })).toBe(1)
    expect(Number.isFinite(unrollProgress(0.1, { delay: 0.1, duration: 0 }))).toBe(true)
  })
})

describe("the clock of a playmat", () => {
  it("holds a rolled one at nothing and a flat one at everything, with no clock running", () => {
    expect(unrollClock("rolled", 12, 99)).toEqual({ progress: 0, started: null })
    expect(unrollClock("flat", 12, 99)).toEqual({ progress: 1, started: null })
  })

  it("starts its clock the first time a playmat is asked to roll out, whatever the time of the page", () => {
    const first = unrollClock("unrolling", null, 500)
    expect(first).toEqual({ progress: 0, started: 500 })
    const later = unrollClock("unrolling", first.started, 500 + PLAYMAT.delay + PLAYMAT.duration / 2)
    expect(later.started).toBe(500)
    expect(later.progress).toBeGreaterThan(0.8)
    expect(unrollClock("unrolling", first.started, 500 + 60).progress).toBe(1)
  })

  it("begins again from its start once it has been rolled up again", () => {
    const run = unrollClock("unrolling", null, 10)
    const back = unrollClock("rolled", run.started, 40)
    expect(back.started).toBeNull()
    expect(unrollClock("unrolling", back.started, 50)).toEqual({ progress: 0, started: 50 })
  })

  it("takes the timing a game gives", () => {
    const { started } = unrollClock("unrolling", null, 0, { delay: 0, duration: 10 })
    expect(unrollClock("unrolling", started, 5, { delay: 0, duration: 10 }).progress).toBeCloseTo(0.875)
  })
})

describe("the roll of cloth", () => {
  // The playmat of Courtisans: 12 wide, and as deep as its picture says
  const MAT = { width: 12, depth: 12 / (2362 / 579) }

  it("starts at the left edge of the playmat and ends at its right edge", () => {
    expect(rollerAt(0, MAT).x).toBeCloseTo(-6)
    expect(rollerAt(1, MAT).x).toBeCloseTo(6)
    expect(rollerAt(0.5, MAT).x).toBeCloseTo(0)
  })

  it("shrinks as the cloth is let out, from a whole roll to a last turn", () => {
    // the sizes the playmat of Courtisans has always had: 0.32 and 0.06
    expect(rollerAt(0, MAT).radius).toBeCloseTo(0.32, 2)
    expect(rollerAt(1, MAT).radius).toBeCloseTo(0.06, 2)
    for (let i = 1; i <= 10; i++) expect(rollerAt(i / 10, MAT).radius).toBeLessThan(rollerAt((i - 1) / 10, MAT).radius)
  })

  it("lies on the table, clear of the rim, whatever its size", () => {
    for (const progress of [0, 0.3, 0.9]) {
      const roller = rollerAt(progress, MAT)
      expect(roller.y - roller.radius).toBeCloseTo(PLAYMAT.thickness + 0.002)
    }
    expect(rollerAt(0.4, { ...MAT, thickness: 0.05 }).y - rollerAt(0.4, { ...MAT, thickness: 0.05 }).radius).toBeCloseTo(0.052)
  })

  it("is seen until the playmat is flat", () => {
    expect(rollerAt(0, MAT).visible).toBe(true)
    expect(rollerAt(0.998, MAT).visible).toBe(true)
    expect(rollerAt(1, MAT).visible).toBe(false)
  })

  it("is as big for a playmat as deep as it is, so a small one has a small roll", () => {
    expect(rollerAt(0, { width: 6, depth: 1.5 }).radius).toBeCloseTo(rollerAt(0, { width: 12, depth: 3 }).radius / 2)
  })

  it("holds a progress outside 0 to 1 at its ends", () => {
    expect(rollerAt(-4, MAT)).toEqual(rollerAt(0, MAT))
    expect(rollerAt(7, MAT)).toEqual(rollerAt(1, MAT))
  })
})

describe("how a cloth is laid over the picture", () => {
  const grid = Array.from({ length: 11 }, (_, i) => i / 10)

  it("covers it with the cloth for `normal`", () => {
    for (const a of grid) for (const b of grid) expect(blendChannel("normal", a, b)).toBe(b)
  })

  it("leaves the picture as it is under a white cloth for `multiply` and under a black one for `screen`", () => {
    for (const a of grid) {
      expect(blendChannel("multiply", a, 1)).toBeCloseTo(a)
      expect(blendChannel("screen", a, 0)).toBeCloseTo(a)
    }
  })

  it("darkens for `multiply` and lightens for `screen`, never the other way", () => {
    for (const a of grid)
      for (const b of grid) {
        expect(blendChannel("multiply", a, b)).toBeLessThanOrEqual(a + 1e-9)
        expect(blendChannel("screen", a, b)).toBeGreaterThanOrEqual(a - 1e-9)
      }
  })

  it("leaves the picture as it is under a middle grey for `soft-light`, `overlay` and `hard-light`", () => {
    for (const a of grid) {
      expect(blendChannel("soft-light", a, 0.5)).toBeCloseTo(a)
    }
    expect(blendChannel("overlay", 0.5, 0.5)).toBeCloseTo(0.5)
    expect(blendChannel("hard-light", 0.4, 0.5)).toBeCloseTo(0.4)
  })

  it("has `overlay` and `hard-light` be each other with the two pictures swapped", () => {
    for (const a of grid) for (const b of grid) expect(blendChannel("hard-light", a, b)).toBeCloseTo(blendChannel("overlay", b, a))
  })

  it("keeps the lighter of the two for `lighten` and the darker for `darken`", () => {
    for (const a of grid)
      for (const b of grid) {
        expect(blendChannel("lighten", a, b)).toBe(Math.max(a, b))
        expect(blendChannel("darken", a, b)).toBe(Math.min(a, b))
      }
  })

  it("stays between black and white for every blend, whatever the two", () => {
    for (const blend of BLENDS)
      for (const a of grid)
        for (const b of grid) {
          const out = blendChannel(blend, a, b)
          expect(out).toBeGreaterThanOrEqual(-1e-9)
          expect(out).toBeLessThanOrEqual(1 + 1e-9)
        }
  })
})

describe("the blends in the shader", () => {
  it("numbers each blend by its place in the list, which is what the shader's mode is", () => {
    expect(BLENDS.map((blend) => BLEND_INDEX[blend])).toEqual(BLENDS.map((_, i) => i))
  })

  it("has one branch for each blend, in order, ending on the cloth itself", () => {
    const branches = BLEND_GLSL.split("\n").filter((line) => line.includes("if (mode <"))
    expect(branches).toHaveLength(BLENDS.length)
    branches.forEach((line, i) => expect(line).toContain(`mode < ${i}.5`))
    expect(BLEND_GLSL.startsWith("vec3 blendCloth(vec3 a, vec3 b, float mode) {")).toBe(true)
    expect(BLEND_GLSL.trimEnd().endsWith("return b;\n}")).toBe(true)
  })

  it("writes the formulas of the functions above", () => {
    expect(BLEND_GLSL).toContain("return a * b;")
    expect(BLEND_GLSL).toContain("return 1.0 - (1.0 - a) * (1.0 - b);")
    expect(BLEND_GLSL).toContain("return (1.0 - 2.0 * b) * a * a + 2.0 * b * a;")
    expect(BLEND_GLSL).toContain("return max(a, b);")
    expect(BLEND_GLSL).toContain("return min(a, b);")
  })
})
