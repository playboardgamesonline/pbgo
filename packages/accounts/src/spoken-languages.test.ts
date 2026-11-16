import { describe, expect, it } from "vitest"
import { SPOKEN_LANGUAGES } from "./language"
import { detailsOf, hasProfileDetails, isSpokenLanguage, noProfileDetails, parseProfileEdit, spokenLanguageName, spokenLanguagesOf } from "./profile-details"

// The languages a member speaks on their profile: the platform's languages, English once (`SPOKEN_LANGUAGES`), in the order the member put them.

describe("isSpokenLanguage", () => {
  it("accepts the languages people speak, and no regional form of one", () => {
    for (const { id } of SPOKEN_LANGUAGES) expect(isSpokenLanguage(id)).toBe(true)
    expect(isSpokenLanguage("fr")).toBe(true)
    expect(isSpokenLanguage("en-GB")).toBe(false)
  })

  it("refuses what is not a code of the list: another case, a language the platform has not, a number, nothing", () => {
    for (const value of ["FR", "Fr", "french", "xx", "", " fr", 7, null, undefined, ["fr"]]) expect(isSpokenLanguage(value)).toBe(false)
  })
})

describe("spokenLanguagesOf", () => {
  it("keeps the codes in the order the member put them", () => {
    expect(spokenLanguagesOf(["ja", "fr", "en"])).toEqual(["ja", "fr", "en"])
    expect(spokenLanguagesOf([])).toEqual([])
  })

  it("refuses a language twice, a code that is not on the list and anything that is not a list of codes", () => {
    expect(spokenLanguagesOf(["fr", "fr"])).toBeNull()
    expect(spokenLanguagesOf(["fr", "xx"])).toBeNull()
    expect(spokenLanguagesOf(["en-GB"])).toBeNull()
    expect(spokenLanguagesOf("fr")).toBeNull()
    expect(spokenLanguagesOf([1])).toBeNull()
    expect(spokenLanguagesOf([null])).toBeNull()
    expect(spokenLanguagesOf(null)).toBeNull()
    expect(spokenLanguagesOf({ 0: "fr", length: 1 })).toBeNull()
  })

  it("takes every language of the list at once, and no more", () => {
    const every = SPOKEN_LANGUAGES.map(({ id }) => id)
    expect(spokenLanguagesOf(every)).toEqual(every)
    expect(spokenLanguagesOf([...every, "fr"])).toBeNull()
  })
})

describe("spokenLanguageName", () => {
  it("is the name of a language in English, as a profile writes it", () => {
    expect(spokenLanguageName("fr")).toBe("French")
    expect(spokenLanguageName("en")).toBe("English")
    expect(spokenLanguageName("ja")).toBe("Japanese")
    expect(spokenLanguageName("pt")).toBe("Portuguese")
  })
})

describe("the languages of a profile", () => {
  it("is empty for a profile that says nothing, and a profile with one says something", () => {
    expect(noProfileDetails().languages).toEqual([])
    expect(hasProfileDetails(noProfileDetails())).toBe(false)
    expect(hasProfileDetails({ ...noProfileDetails(), languages: ["fr"] })).toBe(true)
  })

  it("is read from a row as safely as anything that comes from outside: the codes of the list, none twice, in their order", () => {
    expect(detailsOf({ languages: ["fr", "xx", "fr", "en", "en-GB", 5] }).languages).toEqual(["fr", "en"])
    expect(detailsOf({ languages: "fr" }).languages).toEqual([])
    expect(detailsOf({ languages: null }).languages).toEqual([])
    // A project where the migration is not applied has no such column
    expect(detailsOf({ pronouns: "any" }).languages).toEqual([])
    expect(detailsOf(null).languages).toEqual([])
  })
})

describe("a change of the languages", () => {
  it("is a field of its own: the list as the member put it", () => {
    expect(parseProfileEdit({ languages: ["fr", "en"] })).toEqual({ ok: true, edit: { languages: ["fr", "en"] } })
  })

  it("is empty for an empty list and for null, which take the languages away", () => {
    expect(parseProfileEdit({ languages: [] })).toEqual({ ok: true, edit: { languages: [] } })
    expect(parseProfileEdit({ languages: null })).toEqual({ ok: true, edit: { languages: [] } })
  })

  it("comes with the other fields, and leaves them out when it is not there", () => {
    expect(parseProfileEdit({ bio: "Hello", languages: ["de"] })).toEqual({ ok: true, edit: { bio: "Hello", languages: ["de"] } })
    expect(parseProfileEdit({ bio: "Hello" })).toEqual({ ok: true, edit: { bio: "Hello" } })
  })

  it("is refused when it is not a list of codes of the list, none twice", () => {
    for (const languages of [["fr", "fr"], ["xx"], ["en-GB"], "fr", [1], 7, true, {}]) expect(parseProfileEdit({ languages })).toEqual({ ok: false })
    expect(parseProfileEdit({ bio: "Hello", languages: ["xx"] })).toEqual({ ok: false })
  })
})
