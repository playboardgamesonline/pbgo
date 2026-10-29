import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { DURATION, EASE_STANDARD, SPRING_TRAVEL } from "./motion"

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

  it("keeps the durations in order, and the spring settled (a damping ratio under 1, close to it)", () => {
    expect(DURATION.fast).toBeLessThan(DURATION.base)
    expect(DURATION.base).toBeLessThan(DURATION.slow)
    // ratio = damping / (2 √(stiffness × mass)), the mass being 1
    const ratio = SPRING_TRAVEL.damping / (2 * Math.sqrt(SPRING_TRAVEL.stiffness))
    expect(ratio).toBeGreaterThan(0.8)
    expect(ratio).toBeLessThan(1)
  })
})
