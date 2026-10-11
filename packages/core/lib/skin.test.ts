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

  it("lets a game translate the scoreboard name itself", () => {
    const binding = { I18N: { en: { skin: { texts: { scoreboard: "Final standings" } } } } } as GameBinding
    expect(baseSkin(binding, "en").texts.scoreboard).toBe("Final standings")
    expect(baseSkin(binding, "de").texts.scoreboard).toBe("Punktetabelle")
  })
})
