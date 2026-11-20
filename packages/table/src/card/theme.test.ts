import { describe, expect, it } from "vitest"
import { bloomColor, cardBlooms, FALLBACK_COLORS } from "./theme"

const COLORS = { background: "#021c22", foreground: "#f5f2ea", accent: "#f9dc4f", surface: "#094f5d", surfaceDark: "#043039" }

describe("the colour of a bloom", () => {
  it("is the colour of the game's theme that its key names", () => {
    expect(bloomColor("accent", COLORS)).toBe("#f9dc4f")
    expect(bloomColor("foreground", COLORS)).toBe("#f5f2ea")
    expect(bloomColor("surface", COLORS)).toBe("#094f5d")
  })

  it("is a hex colour as it stands", () => {
    expect(bloomColor("#ff8800", COLORS)).toBe("#ff8800")
  })

  it("is the accent when the key is not a colour of the theme", () => {
    expect(bloomColor("nonsense" as never, COLORS)).toBe("#f9dc4f")
  })
})

describe("the blooms of a game", () => {
  it("are the accent while a card can be chosen, is pressed or is under the pointer, and the text colour once it is picked", () => {
    const blooms = cardBlooms(undefined, COLORS)
    expect(blooms.interactive).toEqual({ color: "#f9dc4f", strength: 1 })
    expect(blooms.hover.color).toBe("#f9dc4f")
    expect(blooms.pressed.color).toBe("#f9dc4f")
    expect(blooms.selected).toEqual({ color: "#f5f2ea", strength: 1 })
  })

  it("follow the colours of the theme, so a colour saved in the gamemaster changes them", () => {
    expect(cardBlooms(undefined, { ...COLORS, accent: "#38e0c0" }).interactive.color).toBe("#38e0c0")
  })

  it("take what the game's UI_THEME says, state by state", () => {
    const blooms = cardBlooms({ selected: { color: "#ffd35c", strength: 1.5 }, hover: { strength: 0.6 } }, COLORS)
    expect(blooms.selected).toEqual({ color: "#ffd35c", strength: 1.5 })
    expect(blooms.hover).toEqual({ color: "#f9dc4f", strength: 0.6 })
    expect(blooms.interactive).toEqual({ color: "#f9dc4f", strength: 1 })
  })

  it("have a colour of their own when no game is shown", () => {
    expect(cardBlooms(undefined, FALLBACK_COLORS).interactive.color).toBe(FALLBACK_COLORS.accent)
  })
})
