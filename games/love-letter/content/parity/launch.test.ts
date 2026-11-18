import { engineTextKeys, GAME } from "@love-letter/engine"
import { LOCALES, type Locale } from "@pbgo/core/lib/i18n"
import { missingTexts } from "@pbgo/core/lib/missing"
import { describe, expect, it } from "vitest"
import { ERROR_CODES } from "../../src/lib/site.ts"
import { seedDocs } from "../data/test-fixtures.ts"

// This folder has its own tsconfig, as `engine.test.ts` explains: the engine loads `@pbgo/engine-kit`, which the seed's own program cannot.

type Localized = Partial<Record<string, string>>
/** The value of a text in each language of the platform, as the Copy page reads it: what is written, trimmed, or nothing */
const stored = (text: Localized | undefined) => Object.fromEntries(LOCALES.map((language) => [language, text?.[language]?.trim() || null])) as Record<Locale, string | null>

describe("the Launch list of the gamemaster", () => {
  const texts = seedDocs().find((doc) => doc._id === "texts")!

  it("reads no text of the game missing in English once the seed is in Sanity: the score lines and the message of its own error code that the engine and the binding ask for, and the victory phrases", () => {
    const engineTexts = new Map((texts.engineTexts as { key: string; text: Localized }[]).map((item) => [item.key, item.text]))
    const errors = new Map((texts.errorMessages as { code: string; message: Localized }[]).map((item) => [item.code, item.message]))
    const phrases = texts.victoryPhrases as Record<string, unknown>
    const copy = {
      entries: [
        ...engineTextKeys(GAME).required.map((key) => ({ label: key, required: true, values: stored(engineTexts.get(key)) })),
        ...ERROR_CODES.map((code) => ({ label: code, required: true, values: stored(errors.get(code)) })),
      ],
      victoryPhrases: { values: Object.fromEntries(LOCALES.map((language) => [language, Array.isArray(phrases[language]) && phrases[language].length > 0 ? (phrases[language] as string[]) : null])) as Record<Locale, string[] | null> },
    }
    // the description is the catalog's, not the seed's: given here, so that only the texts are judged
    const described = Object.fromEntries(LOCALES.map((language) => [language, "A description"])) as Record<Locale, string>
    const gaps = missingTexts(copy, described)
    // Spanish and German have no source: nothing reads missing there, since a language with no text of its own reads English
    expect(gaps).toEqual([])
    expect(copy.entries.length).toBeGreaterThan(0)
  })
})
