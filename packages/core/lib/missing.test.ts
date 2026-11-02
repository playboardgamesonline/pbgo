import { describe, expect, it } from "vitest"
import { LOCALES, type Locale } from "./i18n"
import { gapsOf, isMissing, missing, missingTexts } from "./missing"

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

  it("lists nothing for a language with no value of its own while English has one: it reads English", () => {
    const copy = { ...complete, entries: [{ label: "Tagline", required: true, values: { ...all("Plot and bluff"), es: null, de: "" } }] }
    expect(missingTexts(copy, described("A game"))).toEqual([])
  })

  it("lists a required text in the languages that would read a gap when English has no value", () => {
    const copy = { ...complete, entries: [{ label: "Tagline", required: true, values: { fr: "Une accroche", en: null, es: null, de: "" } }] }
    expect(missingTexts(copy, described("A game"))).toEqual(["Tagline (en, es, de)"])
  })

  it("ignores a text that is optional", () => {
    const copy = { ...complete, entries: [{ label: "Home title", required: false, values: all(null) }] }
    expect(missingTexts(copy, described("A game"))).toEqual([])
  })

  it("lists the victory phrases and the description in the languages that would read a gap", () => {
    const copy = { ...complete, victoryPhrases: { values: { ...phrases(["{pseudo} wins"]), en: null } } }
    expect(missingTexts(copy, { ...described("A game"), en: "" })).toEqual(["Victory phrases (en)", "Description (en)"])
  })

  it("does not list the victory phrases or the description of a language other than English that has none: English has them", () => {
    const copy = { ...complete, victoryPhrases: { values: { ...phrases(["{pseudo} wins"]), fr: null } } }
    expect(missingTexts(copy, { ...described("A game"), fr: "" })).toEqual([])
  })
})

describe("gapsOf", () => {
  it("is empty while English has a value, whatever the other languages hold", () => {
    expect(gapsOf({ fr: null, en: "Hello", es: "", de: null })).toEqual([])
  })

  it("is every language with no value of its own once English has none", () => {
    expect(gapsOf({ fr: "Bonjour", en: null, es: "", de: "Hallo" })).toEqual(["en", "es"])
    expect(gapsOf({ fr: null, en: "", es: null, de: null })).toEqual(["fr", "en", "es", "de"])
  })
})
