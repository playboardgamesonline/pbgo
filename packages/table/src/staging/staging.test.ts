import { describe, expect, it } from "vitest"
import { APPEAR, appearAt } from "./appear-look"
import { VEIL, veilTarget } from "./veil-look"

describe("how far an entrance has come", () => {
  it("is not seen until its delay has passed, and has not come in at that moment", () => {
    expect(appearAt(0, { delay: 1 })).toEqual({ visible: false, progress: 0 })
    expect(appearAt(0.999, { delay: 1 }).visible).toBe(false)
    expect(appearAt(1, { delay: 1 })).toEqual({ visible: true, progress: 0 })
  })

  it("has come in once its delay and its duration have passed", () => {
    expect(appearAt(APPEAR.delay + APPEAR.duration)).toEqual({ visible: true, progress: 1 })
    expect(appearAt(5, { delay: 1, duration: 2 })).toEqual({ visible: true, progress: 1 })
  })

  it("only ever comes in, fast at first and settling", () => {
    const steps = Array.from({ length: 41 }, (_, i) => appearAt((i / 40) * APPEAR.duration).progress)
    for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeGreaterThanOrEqual(steps[i - 1]!)
    expect(steps[20]!).toBeCloseTo(0.875)
    expect(steps[10]! - steps[0]!).toBeGreaterThan(steps[40]! - steps[30]!)
  })

  it("takes the delay and the duration a game gives", () => {
    expect(appearAt(2, { delay: 1, duration: 2 }).progress).toBeCloseTo(0.875)
  })

  it("is over for an elapsed time of infinity, which is a thing that is not entering", () => {
    expect(appearAt(Infinity, { delay: 3 })).toEqual({ visible: true, progress: 1 })
  })

  it("is in at once for a duration of nothing, and never divides by it", () => {
    expect(appearAt(0.5, { delay: 0.5, duration: 0 }).progress).toBe(0)
    expect(appearAt(0.6, { delay: 0.5, duration: 0 }).progress).toBe(1)
  })
})

describe("where a veil is going", () => {
  it("goes to its darkness in the time it takes to come on while it is on", () => {
    expect(veilTarget(true)).toEqual({ to: VEIL.opacity, time: VEIL.fade })
    expect(veilTarget(true, { opacity: 0.8, fade: 0.5 })).toEqual({ to: 0.8, time: 0.5 })
  })

  it("goes to nothing in the time it takes to go while it is off, whatever darkness it has", () => {
    expect(veilTarget(false)).toEqual({ to: 0, time: VEIL.away })
    expect(veilTarget(false, { opacity: 0.8, away: 0.7 })).toEqual({ to: 0, time: 0.7 })
  })

  it("is never darker than black or lighter than clear", () => {
    expect(veilTarget(true, { opacity: 4 }).to).toBe(1)
    expect(veilTarget(true, { opacity: -1 }).to).toBe(0)
  })

  it("is drawn after what is on the table, which sits at order 0", () => {
    expect(VEIL.order).toBeGreaterThan(0)
    expect(VEIL.distance).toBeGreaterThan(0)
  })
})
