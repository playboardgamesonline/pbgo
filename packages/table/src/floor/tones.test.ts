import { describe, expect, it } from "vitest"
import { FALLBACK_COLORS } from "../card/theme"
import { floorTones, toneColour } from "./tones"

const COLORS = { ...FALLBACK_COLORS, accent: "#e8b43a", foreground: "#f5f2ea", surface: "#2f7683" }

describe("floorTones", () => {
  it("is the accent for the action that goes on and the text colour for the quieter ones", () => {
    expect(floorTones(undefined, COLORS)).toEqual({ primary: "#e8b43a", neutral: "#f5f2ea" })
  })

  it("follows the settings: a colour changed in the gamemaster changes the buttons of every game at once", () => {
    expect(floorTones(undefined, { ...COLORS, accent: "#112233" }).primary).toBe("#112233")
    expect(floorTones({}, { ...COLORS, foreground: "#ffffff" }).neutral).toBe("#ffffff")
  })

  it("lets a game name another key of its theme, or a colour", () => {
    expect(floorTones({ primary: "surface", neutral: "#b4c6d8" }, COLORS)).toEqual({ primary: "#2f7683", neutral: "#b4c6d8" })
  })

  it("falls back to the accent for a key that is not one of the theme's", () => {
    expect(floorTones({ neutral: "teal" as never }, COLORS).neutral).toBe("#e8b43a")
  })
})

describe("toneColour", () => {
  const tones = floorTones(undefined, COLORS)

  it("reads a tone by its name, and the primary for none", () => {
    expect(toneColour("primary", tones)).toBe("#e8b43a")
    expect(toneColour("neutral", tones)).toBe("#f5f2ea")
    expect(toneColour(undefined, tones)).toBe("#e8b43a")
  })
})
