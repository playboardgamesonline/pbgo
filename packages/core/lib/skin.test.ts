import { describe, expect, it } from "vitest"
import type { GameBinding } from "./binding"
import type { Locale } from "./i18n"
import { baseSkin, fill } from "./skin"

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

  it("lets a game translate the scoreboard name itself", () => {
    const binding = { I18N: { en: { skin: { texts: { scoreboard: "Final standings" } } } } } as GameBinding
    expect(baseSkin(binding, "en").texts.scoreboard).toBe("Final standings")
    expect(baseSkin(binding, "de").texts.scoreboard).toBe("Punktetabelle")
  })
})
