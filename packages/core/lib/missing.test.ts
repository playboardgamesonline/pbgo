import { describe, expect, it } from "vitest"
import { LOCALES, type Locale } from "./i18n"
import { isMissing, missing, missingTexts } from "./missing"

const all = (value: string | null): Record<Locale, string | null> => Object.fromEntries(LOCALES.map((l) => [l, value])) as Record<Locale, string | null>
const phrases = (value: string[] | null): Record<Locale, string[] | null> => Object.fromEntries(LOCALES.map((l) => [l, value])) as Record<Locale, string[] | null>
const described = (value: string): Record<Locale, string> => Object.fromEntries(LOCALES.map((l) => [l, value])) as Record<Locale, string>

describe("missing", () => {
  it("writes the key of the text in English, in square brackets", () => {
    expect(missing("home.tagline")).toBe("[missing: home.tagline]")
  })

  it("is recognised again by isMissing", () => {
    expect(isMissing(missing("victoryPhrases"))).toBe(true)
    expect(isMissing("Plot and bluff")).toBe(false)
    expect(isMissing("")).toBe(false)
  })
})

describe("missingTexts", () => {
  const complete = {
    entries: [{ label: "Tagline", required: true, values: all("Plot and bluff") }],
    victoryPhrases: { values: phrases(["{pseudo} wins"]) },
  }

  it("is empty when every language has everything", () => {
    expect(missingTexts(complete, described("A game"))).toEqual([])
  })

  it("lists a required text with the languages that have none", () => {
    const copy = { ...complete, entries: [{ label: "Tagline", required: true, values: { ...all("Plot and bluff"), es: null, de: "" } }] }
    expect(missingTexts(copy, described("A game"))).toEqual(["Tagline (es, de)"])
  })

  it("ignores a text that is optional", () => {
    const copy = { ...complete, entries: [{ label: "Home title", required: false, values: all(null) }] }
    expect(missingTexts(copy, described("A game"))).toEqual([])
  })

  it("lists the victory phrases and the description by language", () => {
    const copy = { ...complete, victoryPhrases: { values: { ...phrases(["{pseudo} wins"]), en: null } } }
    expect(missingTexts(copy, { ...described("A game"), fr: "" })).toEqual(["Victory phrases (en)", "Description (fr)"])
  })
})
