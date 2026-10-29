import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { DURATION, EASE_STANDARD, PLAYFUL, SPRING_TRAVEL } from "./motion"

/**
 * `motion.ts` copies the motion tokens of `styles/platform.css` for what `motion/react` animates. This test reads the stylesheet and fails when
 * a copy has drifted: the CSS durations and easing are the ones the JS animations use.
 */

// Comments out, so a `.platform {` or a token named in the header does not shadow the real one
const PLATFORM_CSS = readFileSync(new URL("./styles/platform.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")

/** Value of `--name: value;` in platform.css. */
function token(name: string): string {
  const value = new RegExp(`${name}:\\s*([^;]+);`).exec(PLATFORM_CSS)?.[1]
  if (!value) throw new Error(`${name} is not declared in platform.css`)
  return value.trim()
}

describe("motion tokens", () => {
  it.each(["fast", "base", "slow"] as const)("keeps the %s duration of the stylesheet, in seconds", (name) => {
    expect(token(`--transition-duration-${name}`)).toBe(`${DURATION[name] * 1000}ms`)
  })

  it("keeps the easing of the stylesheet", () => {
    expect(token("--ease-standard")).toBe(`cubic-bezier(${EASE_STANDARD.join(", ")})`)
  })

  it("gives the playful pieces curves that can be drawn (a bezier has its x between 0 and 1) and springs that still wobble but settle", () => {
    for (const curve of [PLAYFUL.die.ease, PLAYFUL.coin.ease, PLAYFUL.cards.ease, PLAYFUL.suit.wheel.ease]) {
      expect(curve[0]).toBeGreaterThanOrEqual(0)
      expect(curve[0]).toBeLessThanOrEqual(1)
      expect(curve[2]).toBeGreaterThanOrEqual(0)
      expect(curve[2]).toBeLessThanOrEqual(1)
    }
    for (const spring of [PLAYFUL.coin.landing, PLAYFUL.cards.open, PLAYFUL.suit.wheel.settle]) {
      const ratio = spring.damping / (2 * Math.sqrt(spring.stiffness))
      expect(ratio).toBeGreaterThan(0.2)
      expect(ratio).toBeLessThan(1)
    }
  })

  it("keeps the turns of the playful pieces few, whole and in order (a die of 2 or 3, which switches between a three and a six, a coin of 1 or 2, which lands on its profile, a wheel of 2 or 3 laps of the four suits, which stops on its heart)", () => {
    for (const range of [PLAYFUL.die.turns, PLAYFUL.coin.turns, PLAYFUL.suit.wheel.laps]) {
      expect(Number.isInteger(range.min)).toBe(true)
      expect(Number.isInteger(range.max)).toBe(true)
      expect(range.min).toBeLessThanOrEqual(range.max)
    }
    expect(PLAYFUL.die.turns.max).toBeLessThanOrEqual(3)
    expect(PLAYFUL.coin.turns.max).toBeLessThanOrEqual(2)
    expect(PLAYFUL.suit.wheel.laps.max).toBeLessThanOrEqual(3)
  })

  it("keeps the wheel slow enough to be read: its fastest moment is under nine places a second", () => {
    const [, y1, , y2] = PLAYFUL.suit.wheel.ease
    const [x1, , x2] = PLAYFUL.suit.wheel.ease
    // The steepest part of the curve, sampled, against the average speed of the shortest turn at the quickest it may be (the seconds of a place, less a tenth)
    const point = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3
    let steepest = 0
    for (let t = 0; t < 1; t += 0.005) {
      const dx = point(t + 0.005, x1, x2) - point(t, x1, x2)
      const dy = point(t + 0.005, y1, y2) - point(t, y1, y2)
      if (dx > 0) steepest = Math.max(steepest, dy / dx)
    }
    const average = 1 / (PLAYFUL.suit.wheel.secondsAPlace * 0.9)
    expect(steepest * average).toBeLessThan(9)
  })

  it("keeps the die calmer than what it was first chosen as (a swell of 1.22), the dip of the coin shallow (over 0.93) and its swell big enough to come at the viewer, and no more (1.2 to 1.6)", () => {
    expect(PLAYFUL.die.swell).toBeLessThan(1.22)
    expect(PLAYFUL.coin.dip).toBeGreaterThan(0.93)
    expect(PLAYFUL.coin.swell).toBeGreaterThan(1.2)
    expect(PLAYFUL.coin.swell).toBeLessThan(1.6)
  })

  it("keeps the durations in order, and the spring settled (a damping ratio under 1, close to it)", () => {
    expect(DURATION.fast).toBeLessThan(DURATION.base)
    expect(DURATION.base).toBeLessThan(DURATION.slow)
    // ratio = damping / (2 √(stiffness × mass)), the mass being 1
    const ratio = SPRING_TRAVEL.damping / (2 * Math.sqrt(SPRING_TRAVEL.stiffness))
    expect(ratio).toBeGreaterThan(0.8)
    expect(ratio).toBeLessThan(1)
  })
})
