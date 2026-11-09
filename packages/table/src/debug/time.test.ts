import { describe, expect, it } from "vitest"
import { type ClockLike, slowClock } from "./time"

/** A clock whose frames last a tenth of a second, and that adds each one to its time as three.js does */
function clock(): ClockLike {
  const c: ClockLike = {
    elapsedTime: 0,
    getDelta: () => {
      c.elapsedTime += 0.1
      return 0.1
    },
  }
  return c
}

describe("slowing the clock", () => {
  it("leaves the frames as they are at full speed", () => {
    const c = clock()
    slowClock(c, { speed: 1, freeze: false })
    expect(c.getDelta()).toBeCloseTo(0.1)
    expect(c.elapsedTime).toBeCloseTo(0.1)
  })

  it("makes a frame last a share of what it lasted, and the time follows", () => {
    const c = clock()
    slowClock(c, { speed: 0.25, freeze: false })
    expect(c.getDelta()).toBeCloseTo(0.025)
    expect(c.getDelta()).toBeCloseTo(0.025)
    expect(c.elapsedTime).toBeCloseTo(0.05)
  })

  it("stops the time when frozen, and lets it go on when thawed", () => {
    const c = clock()
    const time = { speed: 1, freeze: true }
    slowClock(c, time)
    expect(c.getDelta()).toBe(0)
    expect(c.elapsedTime).toBe(0)
    time.freeze = false
    expect(c.getDelta()).toBeCloseTo(0.1)
    expect(c.elapsedTime).toBeCloseTo(0.1)
  })

  it("follows the knob frame by frame, not the value it had when the clock was slowed", () => {
    const c = clock()
    const time = { speed: 1, freeze: false }
    slowClock(c, time)
    c.getDelta()
    time.speed = 0.5
    expect(c.getDelta()).toBeCloseTo(0.05)
    expect(c.elapsedTime).toBeCloseTo(0.15)
  })

  it("puts the clock back", () => {
    const c = clock()
    const real = c.getDelta
    const restore = slowClock(c, { speed: 0.1, freeze: true })
    expect(c.getDelta).not.toBe(real)
    restore()
    expect(c.getDelta).toBe(real)
    expect(c.getDelta()).toBeCloseTo(0.1)
  })
})
