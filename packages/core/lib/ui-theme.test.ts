import { describe, expect, it } from "vitest"
import type { UiTheme } from "./binding"
import { hudStyle } from "./ui-theme"

describe("hudStyle", () => {
  it("sets nothing for a game without a theme: the neutral defaults of styles/game.css apply", () => {
    expect(hudStyle(undefined)).toEqual({})
    expect(hudStyle({})).toEqual({})
  })

  it("writes the fields a game names as --hud-* variables, in CSS terms", () => {
    const theme: UiTheme = {
      accent: "var(--accent-game)",
      onAccent: "var(--surface-dark)",
      surface: "var(--surface-dark)",
      titleFont: "var(--font-accent, var(--font-title))",
      backdrop: "oklch(0 0 0 / 0.7)",
    }
    expect(hudStyle(theme)).toEqual({
      "--hud-accent": "var(--accent-game)",
      "--hud-on-accent": "var(--surface-dark)",
      "--hud-surface": "var(--surface-dark)",
      "--hud-title-font": "var(--font-accent, var(--font-title))",
      "--hud-backdrop": "oklch(0 0 0 / 0.7)",
    })
  })

  it("leaves the other fields to the defaults", () => {
    expect(hudStyle({ accent: "#e8b43a" })).toEqual({ "--hud-accent": "#e8b43a" })
  })

  it("does not turn the motion level into a variable: components read it with useMotion", () => {
    expect(hudStyle({ motion: "lively" })).toEqual({})
  })

  it("ignores blank values and trims the others", () => {
    expect(hudStyle({ accent: "   ", surface: "", titleFont: "  Alegreya  " })).toEqual({ "--hud-title-font": "Alegreya" })
  })
})
