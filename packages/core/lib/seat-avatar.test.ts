import { describe, expect, it } from "vitest"
import { INK_DARK, INK_LIGHT, initialOf, readableOn, seatAvatar } from "./seat-avatar"

describe("initialOf", () => {
  it("is the first letter, upper-cased", () => {
    expect(initialOf("alice")).toBe("A")
    expect(initialOf("Bob")).toBe("B")
  })

  it("keeps an accent", () => {
    expect(initialOf("élodie")).toBe("É")
    expect(initialOf("Ørjan")).toBe("Ø")
    // written as two code points: "e" and a combining acute accent
    expect(initialOf("émile")).toBe("É")
  })

  it("upper-cases to a single character", () => {
    expect(initialOf("ßeta")).toBe("S")
  })

  it("skips spaces and punctuation before the first letter, digit or emoji", () => {
    expect(initialOf("  zoé")).toBe("Z")
    expect(initialOf("@bob")).toBe("B")
    expect(initialOf("-_-Max")).toBe("M")
    expect(initialOf("[2k] Neo")).toBe("2")
  })

  it("takes an emoji whole, joined sequences and flags included", () => {
    expect(initialOf("🦊 Fox")).toBe("🦊")
    expect(initialOf("👩‍🚀 Ripley")).toBe("👩‍🚀")
    expect(initialOf("🇫🇷 Léa")).toBe("🇫🇷")
  })

  it("reads letters of other scripts", () => {
    expect(initialOf("слава")).toBe("С")
    expect(initialOf("李雷")).toBe("李")
  })

  it("falls back on the first character, then on a question mark", () => {
    expect(initialOf("---")).toBe("-")
    expect(initialOf("")).toBe("?")
    expect(initialOf("   ")).toBe("?")
  })
})

describe("readableOn", () => {
  it("is white on a dark colour and near-black on a light one", () => {
    expect(readableOn("#000000")).toBe(INK_LIGHT)
    expect(readableOn("#1b2a49")).toBe(INK_LIGHT)
    expect(readableOn("#ffffff")).toBe(INK_DARK)
    expect(readableOn("#f2c14e")).toBe(INK_DARK)
  })

  it("picks the better contrast on the seat colours of the games", () => {
    // Courtisans
    expect(readableOn("#a8603a")).toBe(INK_LIGHT)
    expect(readableOn("#4f6478")).toBe(INK_LIGHT)
    expect(readableOn("#6f5b99")).toBe(INK_LIGHT)
    // core defaults
    expect(readableOn("#e8795a")).toBe(INK_DARK)
    expect(readableOn("#e8b43a")).toBe(INK_DARK)
    expect(readableOn("#6fd3a8")).toBe(INK_DARK)
  })

  it("reads the short hex forms and the alpha digits", () => {
    expect(readableOn("#fff")).toBe(INK_DARK)
    expect(readableOn("#000f")).toBe(INK_LIGHT)
    expect(readableOn("#ffffff80")).toBe(INK_DARK)
    expect(readableOn("  #FFF ")).toBe(INK_DARK)
  })

  it("reads rgb() and hsl(), comma or space syntax", () => {
    expect(readableOn("rgb(0, 0, 0)")).toBe(INK_LIGHT)
    expect(readableOn("rgb(255 255 255)")).toBe(INK_DARK)
    expect(readableOn("rgba(255, 255, 255, 0.5)")).toBe(INK_DARK)
    expect(readableOn("rgb(255 255 255 / 40%)")).toBe(INK_DARK)
    expect(readableOn("rgb(100% 100% 100%)")).toBe(INK_DARK)
    expect(readableOn("hsl(0, 0%, 100%)")).toBe(INK_DARK)
    expect(readableOn("hsl(220 60% 20%)")).toBe(INK_LIGHT)
    expect(readableOn("hsl(-140deg 60% 90%)")).toBe(INK_DARK)
  })

  it("is white when the colour cannot be read", () => {
    expect(readableOn("var(--accent-game)")).toBe(INK_LIGHT)
    expect(readableOn("goldenrod")).toBe(INK_LIGHT)
    expect(readableOn("#12")).toBe(INK_LIGHT)
    expect(readableOn("rgb(10, 20)")).toBe(INK_LIGHT)
    expect(readableOn("")).toBe(INK_LIGHT)
  })
})

describe("seatAvatar", () => {
  it("is the initial on the seat colour, with a readable ink", () => {
    expect(seatAvatar({ nickname: "élodie", color: "#e8b43a" })).toEqual({ initial: "É", color: "#e8b43a", ink: INK_DARK, imageUrl: null })
    expect(seatAvatar({ nickname: "Bob", color: "#4f6478" })).toEqual({ initial: "B", color: "#4f6478", ink: INK_LIGHT, imageUrl: null })
  })

  it("is deterministic", () => {
    const input = { nickname: "Camille", color: "#9c4c72" }
    expect(seatAvatar(input)).toEqual(seatAvatar({ ...input }))
  })

  it("lets an account picture replace the generated one", () => {
    expect(seatAvatar({ nickname: "Bob", color: "#4f6478", imageUrl: "https://cdn.example/bob.webp" }).imageUrl).toBe("https://cdn.example/bob.webp")
    expect(seatAvatar({ nickname: "Bob", color: "#4f6478", imageUrl: "  " }).imageUrl).toBeNull()
    expect(seatAvatar({ nickname: "Bob", color: "#4f6478", imageUrl: null }).imageUrl).toBeNull()
  })
})
