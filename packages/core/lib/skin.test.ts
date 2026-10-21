import { ERROR_TRANSLATIONS } from "@pbgo/studio-kit/translations"
import { describe, expect, it } from "vitest"
import type { GameBinding } from "./binding"
import type { Locale } from "./i18n"
import { baseSkin, fill, mergeSkin } from "./skin"

describe("baseSkin", () => {
  // the scoreboard dialog is named by this text for screen readers
  it.each<[Locale, string]>([
    ["fr", "Tableau des scores"],
    ["en", "Scoreboard"],
    ["es", "Tabla de puntuaciones"],
    ["de", "Punktetabelle"],
  ])("names the scoreboard in the visitor's language (%s)", (locale, expected) => {
    expect(baseSkin({} as GameBinding, locale).texts.scoreboard).toBe(expected)
  })

  // the buttons of a number option in the lobby are named by these texts for screen readers
  it.each<[Locale, string, string]>([
    ["fr", "Moins", "Plus"],
    ["en", "Less", "More"],
    ["es", "Menos", "Más"],
    ["de", "Weniger", "Mehr"],
  ])("names the buttons of a number option in the visitor's language (%s)", (locale, less, more) => {
    const { texts } = baseSkin({} as GameBinding, locale)
    expect(texts.optionLess).toBe(less)
    expect(texts.optionMore).toBe(more)
  })

  // the shared result image draws these two texts, the scoreboard and the victory banner write the second one
  it.each<[Locale, string, string]>([
    ["fr", "12 points · Victoire", "7 pts"],
    ["en", "12 points · Victory", "7 pts"],
    ["es", "12 puntos · Victoria", "7 pts"],
    ["de", "12 Punkte · Sieg", "7 Pkt."],
  ])("writes the share image headline and the points in the visitor's language (%s)", (locale, headline, points) => {
    const { texts } = baseSkin({} as GameBinding, locale)
    expect(fill(texts.shareHeadline, { points: 12 })).toBe(headline)
    expect(fill(texts.pointsShort, { points: 7 })).toBe(points)
  })

  // French is what the image and the scoreboard wrote before the texts were translated
  it.each([0, 7, 12, -3, 100])("keeps the French headline and points as they were (%i)", (total) => {
    const { texts } = baseSkin({} as GameBinding, "fr")
    expect(fill(texts.shareHeadline, { points: total })).toBe(`${total} points · Victoire`)
    expect(fill(texts.pointsShort, { points: total })).toBe(`${total} pts`)
  })

  // A game's own texts come from Sanity only: until they are there, the skin says so instead of carrying a copy of them
  it.each<Locale>(["fr", "en", "es", "de"])("marks the game's own texts as missing until Sanity holds them (%s)", (locale) => {
    const skin = baseSkin({} as GameBinding, locale)
    expect(skin.home.tagline).toBe("[missing: home.tagline]")
    expect(skin.victoryPhrases).toEqual(["[missing: victoryPhrases]"])
    expect(skin.home.title).toBeNull()
    expect(skin.home.intro).toBeNull()
  })

  it("carries the platform's error messages for the other languages and none for French", () => {
    expect(baseSkin({} as GameBinding, "fr").errors).toEqual({})
    expect(baseSkin({} as GameBinding, "en").errors).toEqual(ERROR_TRANSLATIONS.en)
    expect(baseSkin({} as GameBinding, "de").errors).toEqual(ERROR_TRANSLATIONS.de)
  })

  it("keeps the behaviour a game declares and nothing else", () => {
    const binding = { DEFAULT_SKIN: { playerColors: ["#111111", "#222222"], desktopOnly: false } } as GameBinding
    const skin = baseSkin(binding, "en")
    expect(skin.playerColors).toEqual(["#111111", "#222222"])
    expect(skin.desktopOnly).toBe(false)
    expect(skin.home.tagline).toBe("[missing: home.tagline]")
  })
})

describe("mergeSkin", () => {
  const base = baseSkin({} as GameBinding, "en")

  it("lets the texts of Sanity replace the markers", () => {
    const skin = mergeSkin(base, { home: { tagline: "Plot and bluff" }, victoryPhrases: ["{pseudo} wins"] })
    expect(skin.home.tagline).toBe("Plot and bluff")
    expect(skin.victoryPhrases).toEqual(["{pseudo} wins"])
  })

  it("leaves the marker when Sanity has no value", () => {
    expect(mergeSkin(base, { home: { tagline: null, title: null } }).home.tagline).toBe("[missing: home.tagline]")
    expect(mergeSkin(base, { texts: { scoreboard: "  " } }).texts.scoreboard).toBe(base.texts.scoreboard)
  })

  it("is the base itself without anything to merge", () => {
    expect(mergeSkin(base, undefined)).toBe(base)
  })
})
