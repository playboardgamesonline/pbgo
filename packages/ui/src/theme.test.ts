import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"
import { PLATFORM_THEME_COLOR } from "./theme"

/**
 * `theme.ts` copies tokens of `styles/platform.css` for the places that cannot read a CSS variable (the `theme-color`
 * meta tag). This test reads the stylesheet and Tailwind's own palette and fails when a copy has drifted.
 */

const require = createRequire(import.meta.url)

// Comments out, so a `.platform {` in the header does not shadow the real block
const PLATFORM_CSS = readFileSync(new URL("./styles/platform.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
const TAILWIND_THEME = readFileSync(require.resolve("tailwindcss/theme.css"), "utf8")

/** Value of `--name` in the first `.platform { … }` block of platform.css, or nothing when that block does not declare it. */
function declaredOnPlatform(name: string): string | undefined {
  const block = /\.platform\s*\{([^}]*)\}/.exec(PLATFORM_CSS)?.[1]
  return block ? new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim() : undefined
}

/** Value of `--name` in the first `.platform { … }` block of platform.css. */
function platformToken(name: string): string {
  const value = declaredOnPlatform(name)
  if (!value) throw new Error(`${name} is not declared on .platform`)
  return value
}

/** Value of `--name` in Tailwind's default theme, e.g. `--color-neutral-950` → `oklch(14.5% 0 none)`. */
function tailwindToken(name: string): string {
  const value = new RegExp(`${name}:\\s*([^;]+);`).exec(TAILWIND_THEME)?.[1]
  if (!value) throw new Error(`${name} is not in Tailwind's theme`)
  return value.trim()
}

/** `oklch(L C H)` (L as a number or a percentage, H a number or `none`) → `#rrggbb`, through Oklab and linear sRGB. */
function oklchToHex(oklch: string): string {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+|none)\s*\)$/.exec(oklch)
  if (!match) throw new Error(`Not an oklch colour: ${oklch}`)
  const lightness = Number(match[1]) / (match[2] === "%" ? 100 : 1)
  const chroma = Number(match[3])
  const hue = match[4] === "none" ? 0 : (Number(match[4]) * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  const channel = (value: number) => {
    const clamped = Math.min(1, Math.max(0, value))
    const gamma = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
    return Math.round(gamma * 255).toString(16).padStart(2, "0")
  }
  return `#${linear.map(channel).join("")}`
}

describe("theme.ts", () => {
  it("PLATFORM_THEME_COLOR is the platform --background", () => {
    const background = platformToken("--background")
    const colorVar = /^var\((--color-[\w-]+)\)$/.exec(background)?.[1]
    expect(colorVar, `--background must be a Tailwind colour variable, found ${background}`).toBeDefined()
    // The platform redeclares the steps of the neutral scale to tint them (`.platform`); a step it leaves alone is Tailwind's own
    expect(oklchToHex(declaredOnPlatform(colorVar!) ?? tailwindToken(colorVar!))).toBe(PLATFORM_THEME_COLOR)
  })

  it("the neutral scale of the platform keeps Tailwind's order and stays within 0.04 of its lightness, step for step", () => {
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    let before = 1
    for (const step of steps) {
      const name = `--color-neutral-${step}`
      const ours = Number(/oklch\(\s*([\d.]+)/.exec(platformToken(name))?.[1])
      const theirs = Number(/oklch\(\s*([\d.]+)%/.exec(tailwindToken(name))?.[1]) / 100
      expect(Math.abs(ours - theirs), `${name}: ${ours} against Tailwind's ${theirs}`).toBeLessThanOrEqual(0.04)
      expect(ours, `${name} is darker than the step before it`).toBeLessThan(before)
      before = ours
    }
  })
})
