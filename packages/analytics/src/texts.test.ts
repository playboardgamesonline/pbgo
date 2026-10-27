import { LANGUAGES } from "@pbgo/studio-kit/constants"
import { describe, expect, it } from "vitest"
import { BANNER_TEXTS } from "./texts"

/**
 * The sentence takes two or three lines in the card on a desktop and a few more on a phone. A longer one makes the card taller,
 * and the page gives up that much of the screen until the visitor answers.
 */
const BODY_MAX = 140
const WORD_MAX = 14

describe("BANNER_TEXTS", () => {
  it("has a text for every language of the site", () => {
    expect(Object.keys(BANNER_TEXTS).sort()).toEqual(LANGUAGES.map((language) => language.id).sort())
  })

  it("has every field, filled, in every language", () => {
    const fields = Object.keys(BANNER_TEXTS.en).sort()
    for (const [locale, texts] of Object.entries(BANNER_TEXTS)) {
      expect(Object.keys(texts).sort(), locale).toEqual(fields)
      for (const [field, text] of Object.entries(texts)) expect(text.trim(), `${locale}.${field}`).not.toBe("")
    }
  })

  it("keeps the sentence and the words of the buttons short enough for a small card", () => {
    for (const [locale, texts] of Object.entries(BANNER_TEXTS)) {
      expect(texts.body.length, `${locale}.body`).toBeLessThanOrEqual(BODY_MAX)
      expect(texts.body, `${locale}.body`).not.toContain("\n")
      for (const field of ["accept", "refuse", "more"] as const) {
        expect(texts[field].length, `${locale}.${field}`).toBeLessThanOrEqual(WORD_MAX)
      }
    }
  })
})
