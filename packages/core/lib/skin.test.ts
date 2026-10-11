import { describe, expect, it } from "vitest"
import type { GameBinding } from "./binding"
import type { Locale } from "./i18n"
import { baseSkin } from "./skin"

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

  it("lets a game translate the scoreboard name itself", () => {
    const binding = { I18N: { en: { skin: { texts: { scoreboard: "Final standings" } } } } } as GameBinding
    expect(baseSkin(binding, "en").texts.scoreboard).toBe("Final standings")
    expect(baseSkin(binding, "de").texts.scoreboard).toBe("Punktetabelle")
  })
})
