import { isPlatformLanguage, LANGUAGE_COOKIE, type PlatformLanguage } from "@pbgo/accounts/language"
import { LOCALE_COOKIE as BANNER_LOCALE_COOKIE, pickLocale } from "@pbgo/analytics"
import { DEFAULT_PLATFORM_LANGUAGE, PLATFORM_LANGUAGES } from "@pbgo/studio-kit/constants"
import { describe, expect, expectTypeOf, it } from "vitest"
import { DEFAULT_LOCALE, fromAcceptLanguage, LOCALE_COOKIE, localeFor, LOCALES, only, translate, type Locale, type Localized, written } from "./i18n"

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

  it("answers a cookie of the visitor's thirteen languages the way the games do: its own language when the site has it, English when not", () => {
    for (const { id } of PLATFORM_LANGUAGES) expect(pickLocale({ cookie: id, languages: ["de"] })).toBe(localeFor(id))
  })
})

describe("the languages of a visitor and the languages of a site", () => {
  it("make two sets: a visitor chooses among thirteen, the games render four, and the four are among the thirteen", () => {
    expect(PLATFORM_LANGUAGES).toHaveLength(13)
    expect([...LOCALES]).toEqual(["fr", "en", "es", "de"])
    expectTypeOf<Locale>().toExtend<PlatformLanguage>()
    expectTypeOf<PlatformLanguage>().not.toExtend<Locale>()
    for (const locale of LOCALES) expect(isPlatformLanguage(locale)).toBe(true)
  })

  it("render a visitor's language when the site has it, English when it does not", () => {
    for (const language of ["fr", "en", "es", "de"] as const) expect(localeFor(language)).toBe(language)
    for (const language of ["en-GB", "zh", "ja", "ru", "ar", "bn", "hi", "pt", "ko"] as const) expect(localeFor(language)).toBe("en")
  })

  it("read the cookie of the language that the accounts write", () => {
    expect(LOCALE_COOKIE).toBe(LANGUAGE_COOKIE)
    expect(LOCALE_COOKIE).toBe("pbgo-locale")
  })
})

describe("the default language", () => {
  it("is English: a page is drawn in it when nothing asks for another, and every text falls back on it", () => {
    expect(DEFAULT_LOCALE).toBe("en")
  })

  it("is the default language of the platform too: what the games fall back on is what the visitor's account falls back on", () => {
    expect(DEFAULT_LOCALE).toBe(DEFAULT_PLATFORM_LANGUAGE)
    expect(PLATFORM_LANGUAGES[0].id).toBe(DEFAULT_LOCALE)
  })

  it("is what a request gets when the browser asks for no language the games have, or sends no header at all (a crawler)", () => {
    expect(fromAcceptLanguage(null)).toBe("en")
    expect(fromAcceptLanguage(undefined)).toBe("en")
    expect(fromAcceptLanguage("")).toBe("en")
    expect(fromAcceptLanguage("ja,pt-BR;q=0.8")).toBe("en")
  })

  it("does not take the place of the language a browser asks for, when the games have it", () => {
    expect(fromAcceptLanguage("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr")
    expect(fromAcceptLanguage("ja,de;q=0.8")).toBe("de")
    expect(fromAcceptLanguage("es-MX")).toBe("es")
  })
})

describe("translate", () => {
  const text = (values: Partial<Record<Locale, string | null>>): Localized => values

  it("gives the language asked", () => {
    expect(translate(text({ fr: "Bonjour", en: "Hello", es: "Hola", de: "Hallo" }), "es")).toBe("Hola")
    expect(translate(text({ fr: "Bonjour", en: "Hello" }), "fr")).toBe("Bonjour")
  })

  it("gives English when the language asked has no value of its own", () => {
    expect(translate(text({ fr: "Bonjour", en: "Hello" }), "es")).toBe("Hello")
    expect(translate(text({ en: "Hello", de: "" }), "de")).toBe("Hello")
    expect(translate(text({ en: "Hello", es: "   " }), "es")).toBe("Hello")
    expect(translate(text({ en: "Hello", de: null }), "de")).toBe("Hello")
  })

  it("asks for English when no language is given", () => {
    expect(translate(text({ fr: "Bonjour", en: "Hello" }))).toBe("Hello")
  })

  it("gives nothing, never French or the first language filled in, when neither the language asked nor English has a value", () => {
    expect(translate(text({ fr: "Bonjour", es: "Hola", de: "Hallo" }), "en")).toBeUndefined()
    expect(translate(text({ fr: "Bonjour" }), "es")).toBeUndefined()
    expect(translate(text({ fr: "Bonjour", es: "Hola" }), "de")).toBeUndefined()
    expect(translate(text({ fr: "Bonjour", en: "" }), "fr")).toBe("Bonjour")
    expect(translate(text({ en: null, es: null }), "es")).toBeUndefined()
  })

  it("gives nothing for a text that does not exist", () => {
    expect(translate(null, "en")).toBeUndefined()
    expect(translate(undefined, "fr")).toBeUndefined()
    expect(translate({}, "de")).toBeUndefined()
  })

  it("follows the same chain for a list, and takes an empty list for no value", () => {
    const phrases: Localized<string[]> = { fr: ["Bravo", "Champion"], en: ["Well played"], es: [] }
    expect(translate(phrases, "fr")).toEqual(["Bravo", "Champion"])
    expect(translate(phrases, "es")).toEqual(["Well played"])
    expect(translate(phrases, "de")).toEqual(["Well played"])
    expect(translate({ fr: ["Bravo"], en: [] } as Localized<string[]>, "de")).toBeUndefined()
  })
})

describe("written", () => {
  it("gives what is written in exactly that language, with no fallback", () => {
    expect(written({ fr: "Rejouer", en: "Play again" }, "en")).toBe("Play again")
    expect(written({ en: "Play again" }, "es")).toBeUndefined()
    expect(written({ fr: "Rejouer" }, "en")).toBeUndefined()
    expect(written({ en: "  " }, "en")).toBeUndefined()
    expect(written(null, "en")).toBeUndefined()
  })
})

describe("only", () => {
  it("is translate, now that a gap in a language reads English before it reads as missing", () => {
    expect(only).toBe(translate)
    expect(only({ en: "Hello" }, "de")).toBe("Hello")
    expect(only({ fr: "Bonjour" }, "de")).toBeUndefined()
  })
})
