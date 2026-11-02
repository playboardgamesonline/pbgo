import { isPlatformLanguage, LANGUAGE_COOKIE, type PlatformLanguage } from "@pbgo/accounts/language"
import { LOCALE_COOKIE as BANNER_LOCALE_COOKIE, pickLocale } from "@pbgo/analytics"
import { PLATFORM_LANGUAGES } from "@pbgo/studio-kit/constants"
import { describe, expect, expectTypeOf, it } from "vitest"
import { DEFAULT_LOCALE, FALLBACK_LOCALE, fromAcceptLanguage, LOCALE_COOKIE, localeFor, LOCALES, type Locale } from "./i18n"

// The cookie banner of `@pbgo/analytics` cannot import core (core depends on it), so it keeps its own copy of what it needs to
// speak the visitor's language. These tests are what keeps the copy honest.
describe("language of the cookie banner", () => {
  it("reads the cookie the language picker writes", () => {
    expect(BANNER_LOCALE_COOKIE).toBe(LOCALE_COOKIE)
  })

  // `navigator.languages` is the Accept-Language header in order of preference: both must land on the same language
  it.each<[string, string[]]>([
    ["a supported language first", ["de", "en"]],
    ["a regional variant", ["fr-CA", "fr", "en"]],
    ["an unsupported language before a supported one", ["pt-BR", "es-MX", "en"]],
    ["upper case tags", ["ES-es"]],
    ["only unsupported languages", ["ja", "ko"]],
    ["no language at all", []],
  ])("picks the language of the site's pages for %s", (_name, languages) => {
    const header = languages.length ? languages.map((tag, i) => (i === 0 ? tag : `${tag};q=${(1 - i / 10).toFixed(1)}`)).join(",") : null
    expect(pickLocale({ languages })).toBe(fromAcceptLanguage(header))
  })

  it("answers in every language of the site", () => {
    for (const locale of LOCALES) expect(pickLocale({ cookie: locale })).toBe(locale)
  })

  it("answers a cookie of the visitor's twelve languages the way the games do: its own language when the site has it, English when not", () => {
    for (const { id } of PLATFORM_LANGUAGES) expect(pickLocale({ cookie: id, languages: ["de"] })).toBe(localeFor(id))
  })
})

describe("the languages of a visitor and the languages of a site", () => {
  it("make two sets: a visitor chooses among twelve, the games render four, and the four are among the twelve", () => {
    expect(PLATFORM_LANGUAGES).toHaveLength(12)
    expect([...LOCALES]).toEqual(["fr", "en", "es", "de"])
    expectTypeOf<Locale>().toExtend<PlatformLanguage>()
    expectTypeOf<PlatformLanguage>().not.toExtend<Locale>()
    for (const locale of LOCALES) expect(isPlatformLanguage(locale)).toBe(true)
  })

  it("render a visitor's language when the site has it, English when it does not", () => {
    for (const language of ["fr", "en", "es", "de"] as const) expect(localeFor(language)).toBe(language)
    for (const language of ["zh", "ja", "ru", "ar", "bn", "hi", "pt", "ko"] as const) expect(localeFor(language)).toBe("en")
    expect(FALLBACK_LOCALE).toBe("en")
  })

  it("keep French as the default of the games: the account's language does not change it (it decides what a crawler without a header is shown)", () => {
    expect(DEFAULT_LOCALE).toBe("fr")
    expect(fromAcceptLanguage(null)).toBe("fr")
    expect(fromAcceptLanguage("ja,pt-BR;q=0.8")).toBe("en")
  })

  it("read the cookie of the language that the accounts write", () => {
    expect(LOCALE_COOKIE).toBe(LANGUAGE_COOKIE)
    expect(LOCALE_COOKIE).toBe("pbgo-locale")
  })
})
