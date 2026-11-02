import { LANGUAGES } from "@pbgo/studio-kit/constants"
import { describe, expect, it } from "vitest"
import { BANNER_TEXTS } from "./texts"

/**
 * The sentence takes three or four lines in the card on a desktop and a few more on a phone. A longer one makes the card taller,
 * and the page gives up that much of the screen until the visitor answers. The words of a button are short too: two of them
 * share a line next to the sentence, and on a phone they share the width of the card. The owner's English sentence is 196
 * characters and the longest draft, the German, 226.
 */
const BODY_MAX = 230
const WORD_MAX = 24
/** What a row of the choices says under its title: two lines in a column that is 30rem wide. */
const ROW_MAX = 190

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
      for (const field of ["accept", "refuse"] as const) {
        expect(texts[field].length, `${locale}.${field}`).toBeLessThanOrEqual(WORD_MAX)
      }
      // Customize has the whole width of the block over the two others
      expect(texts.customize.length, `${locale}.customize`).toBeLessThanOrEqual(WORD_MAX + 6)
      // The link ends the sentence: it reads as part of it
      expect(texts.more.length, `${locale}.more`).toBeLessThanOrEqual(30)
    }
  })

  it("keeps the words of the choices short too: a sentence, three rows of a title and a line, a word beside each switch", () => {
    for (const [locale, texts] of Object.entries(BANNER_TEXTS)) {
      expect(texts.intro.length, `${locale}.intro`).toBeLessThanOrEqual(BODY_MAX)
      for (const field of ["necessaryBody", "analyticsBody", "marketingBody"] as const) {
        expect(texts[field].length, `${locale}.${field}`).toBeLessThanOrEqual(ROW_MAX)
        expect(texts[field], `${locale}.${field}`).not.toContain("\n")
      }
      for (const field of ["necessary", "analytics", "marketing", "required", "on", "off", "save", "back"] as const) {
        expect(texts[field].length, `${locale}.${field}`).toBeLessThanOrEqual(WORD_MAX)
      }
    }
  })
})
