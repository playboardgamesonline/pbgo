import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { MOTION_ATTRIBUTE, resolveReducedMotion } from "./reduced-motion"

describe("resolveReducedMotion", () => {
  it("follows the member's choice first: always reduces, never keeps the motion, whatever the device asks", () => {
    expect(resolveReducedMotion("always", false)).toBe(true)
    expect(resolveReducedMotion("always", true)).toBe(true)
    expect(resolveReducedMotion("never", true)).toBe(false)
    expect(resolveReducedMotion("never", false)).toBe(false)
  })

  it("follows the device when there is no choice, or when the attribute holds anything else", () => {
    expect(resolveReducedMotion(null, true)).toBe(true)
    expect(resolveReducedMotion(null, false)).toBe(false)
    expect(resolveReducedMotion("", true)).toBe(true)
    expect(resolveReducedMotion("auto", true)).toBe(true)
    expect(resolveReducedMotion("sometimes", false)).toBe(false)
  })
})

describe("the attribute of <html>", () => {
  // The head script of every page (`@pbgo/accounts/motion`) writes it, the stylesheet and the hook read it: one name, said in three places, none of which can import the others
  const accounts = readFileSync(new URL("../../accounts/src/motion.ts", import.meta.url), "utf8")
  const css = readFileSync(new URL("./styles/platform.css", import.meta.url), "utf8")

  it("is the one that the accounts' script writes", () => {
    expect(accounts).toContain(`MOTION_ATTRIBUTE = "${MOTION_ATTRIBUTE}"`)
  })

  it("is the one that the stylesheet reads: for the durations, and for both of the variants", () => {
    const named = css.match(/\[(data-[a-z-]+)="(?:always|never)"\]/g) ?? []
    expect(named.length).toBeGreaterThan(0)
    for (const selector of named) expect(selector.startsWith(`[${MOTION_ATTRIBUTE}=`)).toBe(true)
    expect(css).toMatch(/@custom-variant motion-reduce/)
    expect(css).toMatch(/@custom-variant motion-safe/)
    expect(css).toMatch(/:root\[data-reduce-motion="always"\]\.platform/)
    expect(css).toMatch(/:root:not\(\[data-reduce-motion="never"\]\)\.platform/)
  })

  it("is read through the hook and `MotionPreference` by every platform component that moves, and not through `motion`'s own `useReducedMotion` or `reducedMotion=\"user\"`, which follow the device alone", () => {
    const directory = new URL("./platform/", import.meta.url)
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".tsx"))) {
      const source = readFileSync(new URL(file, directory), "utf8")
      expect(source, `${file} reads motion's own useReducedMotion`).not.toMatch(/useReducedMotion[^"]*\}\s*from\s*"motion\/react"/)
      expect(source, `${file} uses reducedMotion="user"`).not.toMatch(/reducedMotion="user"/)
      expect(source, `${file} asks the device for reduced motion on its own`).not.toMatch(/matchMedia\(\s*"\(prefers-reduced-motion/)
    }
  })
})
