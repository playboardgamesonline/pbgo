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

/** Value of `--name` in the first `.platform { … }` block of platform.css. */
function platformToken(name: string): string {
  const block = /\.platform\s*\{([^}]*)\}/.exec(PLATFORM_CSS)?.[1]
  const value = block && new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1]
  if (!value) throw new Error(`${name} is not declared on .platform`)
  return value.trim()
}

/** Value of `--name` in Tailwind's default theme, e.g. `--color-neutral-950` → `oklch(14.5% 0 none)`. */
function tailwindToken(name: string): string {
  const value = new RegExp(`${name}:\\s*([^;]+);`).exec(TAILWIND_THEME)?.[1]
  if (!value) throw new Error(`${name} is not in Tailwind's theme`)
  return value.trim()
}

/** `oklch(L% 0 …)` → `#rrggbb`. Greys only: with no chroma the colour is L³ in linear sRGB, on all three channels. */
function greyToHex(oklch: string): string {
  const match = /^oklch\(\s*([\d.]+)%\s+([\d.]+)/.exec(oklch)
  if (!match) throw new Error(`Not an oklch colour: ${oklch}`)
  expect(Number(match[2]), `${oklch} is not a grey`).toBe(0)
  const linear = (Number(match[1]) / 100) ** 3
  const gamma = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055
  return `#${Math.round(gamma * 255).toString(16).padStart(2, "0").repeat(3)}`
}

describe("theme.ts", () => {
  it("PLATFORM_THEME_COLOR is the platform --background", () => {
    const background = platformToken("--background")
    const colorVar = /^var\((--color-[\w-]+)\)$/.exec(background)?.[1]
    expect(colorVar, `--background must be a Tailwind colour variable, found ${background}`).toBeDefined()
    expect(greyToHex(tailwindToken(colorVar!))).toBe(PLATFORM_THEME_COLOR)
  })
})
