import { LOCALE_COOKIE as BANNER_LOCALE_COOKIE, pickLocale } from "@pbgo/analytics"
import { describe, expect, it } from "vitest"
import { fromAcceptLanguage, LOCALE_COOKIE, LOCALES } from "./i18n"

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
})
