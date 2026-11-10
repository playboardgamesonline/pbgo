import { LANGUAGES, PLATFORM_LANGUAGES } from "@pbgo/studio-kit/constants"
import { describe, expect, expectTypeOf, it } from "vitest"
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  LANGUAGE_KEY,
  PLATFORM_LANGUAGE_NAMES,
  PLATFORM_LANGUAGE_REGIONS,
  SPOKEN_LANGUAGES,
  baseLanguageOf,
  hasSessionCookie,
  isPlatformLanguage,
  languageCookie,
  languageFromCookies,
  languageOf,
  matchPlatformLanguage,
  planLanguage,
  resolveLanguage,
  type PlatformLanguage,
} from "./language"

describe("the languages of the platform", () => {
  it("are thirteen, English (US) first and English (UK) second, and English (US) is the default", () => {
    expect(PLATFORM_LANGUAGES.map((language) => language.id)).toEqual(["en", "en-GB", "fr", "es", "de", "zh", "ja", "ru", "ar", "bn", "hi", "pt", "ko"])
    expect(DEFAULT_LANGUAGE).toBe("en")
    expect(PLATFORM_LANGUAGES[0].id).toBe(DEFAULT_LANGUAGE)
  })

  it("have a name in their own language, and the two Englishes say which one they are", () => {
    expect(PLATFORM_LANGUAGE_NAMES.en).toBe("English (US)")
    expect(PLATFORM_LANGUAGE_NAMES["en-GB"]).toBe("English (UK)")
    expect(PLATFORM_LANGUAGE_NAMES.ja).toBe("日本語")
    expect(PLATFORM_LANGUAGE_NAMES.zh).toBe("中文 (简体)")
    expect(PLATFORM_LANGUAGE_NAMES.ar).toBe("العربية")
    expect(Object.keys(PLATFORM_LANGUAGE_NAMES)).toHaveLength(13)
  })

  it("each have the country of a flag, a code of two capital letters, and none more than the list holds", () => {
    expect(Object.keys(PLATFORM_LANGUAGE_REGIONS)).toEqual(PLATFORM_LANGUAGES.map((language) => language.id))
    for (const region of Object.values(PLATFORM_LANGUAGE_REGIONS)) expect(region).toMatch(/^[A-Z]{2}$/)
    expect(PLATFORM_LANGUAGE_REGIONS.fr).toBe("FR")
    expect(PLATFORM_LANGUAGE_REGIONS.en).toBe("US")
    expect(PLATFORM_LANGUAGE_REGIONS["en-GB"]).toBe("GB")
  })

  it("include the four languages of the games, whose own list is not changed", () => {
    const platform = PLATFORM_LANGUAGES.map((language) => language.id) as string[]
    expect(LANGUAGES.map((language) => language.id)).toEqual(["fr", "en", "es", "de"])
    for (const game of LANGUAGES) expect(platform).toContain(game.id)
    expectTypeOf<(typeof LANGUAGES)[number]["id"]>().toExtend<PlatformLanguage>()
  })
})

describe("isPlatformLanguage", () => {
  it("accepts the thirteen and nothing else", () => {
    for (const { id } of PLATFORM_LANGUAGES) expect(isPlatformLanguage(id)).toBe(true)
    for (const value of ["", "xx", "EN", "en-US", "en-AU", "en-gb", "EN-GB", "en_GB", "jp", "zh-Hant", " fr", null, undefined, 42, {}, ["fr"]]) expect(isPlatformLanguage(value)).toBe(false)
  })
})

describe("baseLanguageOf", () => {
  it("is the language that a form is a form of: English (UK) is a form of English (US), the English of the platform", () => {
    expect(baseLanguageOf("en-GB")).toBe("en")
  })

  it("is the language itself for every language that is not a form of another", () => {
    for (const { id } of PLATFORM_LANGUAGES) if (!id.includes("-")) expect(baseLanguageOf(id)).toBe(id)
  })
})

describe("SPOKEN_LANGUAGES", () => {
  it("are the languages of the platform without the forms of another: English once", () => {
    expect(SPOKEN_LANGUAGES.map(({ id }) => id)).toEqual(["en", "fr", "es", "de", "zh", "ja", "ru", "ar", "bn", "hi", "pt", "ko"])
  })

  it("call English by its plain name, since a table has only one, and every other language by the name the picker gives it", () => {
    expect(SPOKEN_LANGUAGES[0]).toEqual({ id: "en", name: "English" })
    expect(SPOKEN_LANGUAGES.find(({ id }) => id === "fr")).toEqual({ id: "fr", name: "Français" })
    expect(SPOKEN_LANGUAGES.find(({ id }) => id === "zh")).toEqual({ id: "zh", name: "中文 (简体)" })
  })
})

describe("matchPlatformLanguage", () => {
  it("takes the first language of the browser that the platform has", () => {
    expect(matchPlatformLanguage("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr")
    expect(matchPlatformLanguage("sv,ja;q=0.9,fr;q=0.8")).toBe("ja")
    expect(matchPlatformLanguage(["sv-SE", "ko-KR", "en-US"])).toBe("ko")
  })

  it("reads the first part of the tag: a region or a script does not matter", () => {
    expect(matchPlatformLanguage("pt-BR")).toBe("pt")
    expect(matchPlatformLanguage("pt-PT")).toBe("pt")
    expect(matchPlatformLanguage("es-419")).toBe("es")
    expect(matchPlatformLanguage("de-CH")).toBe("de")
    expect(matchPlatformLanguage("pt_BR")).toBe("pt")
  })

  it("gives English (UK) to the English of the UK alone, and English (US) to every other English", () => {
    for (const tag of ["en-GB", "en-gb", "EN-GB", "en_GB", "en-Latn-GB", "en-GB-oxendict", "en-GB-u-ca-gregory"]) expect(matchPlatformLanguage(tag), tag).toBe("en-GB")
    for (const tag of ["en", "en-US", "en-CA", "en-AU", "en-NZ", "en-IE", "en-IN", "en-ZA", "en-001", "en-150", "en-Latn-US"]) expect(matchPlatformLanguage(tag), tag).toBe("en")
  })

  it("does not take the UK for a form of another language, nor a region that stands after an extension", () => {
    expect(matchPlatformLanguage("fr-GB")).toBe("fr")
    expect(matchPlatformLanguage("de-GB")).toBe("de")
    expect(matchPlatformLanguage("en-x-gb")).toBe("en")
    expect(matchPlatformLanguage("en-u-ca-gb")).toBe("en")
  })

  it("puts the English of the UK where the browser put it among its languages", () => {
    expect(matchPlatformLanguage("en-GB,en;q=0.9,fr;q=0.8")).toBe("en-GB")
    expect(matchPlatformLanguage("en,en-GB;q=0.9")).toBe("en")
    expect(matchPlatformLanguage("fr-FR,fr;q=0.9,en-GB;q=0.8")).toBe("fr")
    expect(matchPlatformLanguage("sv,en-GB;q=0.5")).toBe("en-GB")
    expect(matchPlatformLanguage(["sv-SE", "en-GB", "en-US"])).toBe("en-GB")
  })

  it("gives every Chinese, simplified or not, Chinese (Simplified)", () => {
    for (const tag of ["zh", "zh-CN", "zh-TW", "zh-HK", "zh-Hans", "zh-Hant", "zh-Hant-TW", "ZH-cn"]) expect(matchPlatformLanguage(tag)).toBe("zh")
  })

  it("finds each of the thirteen by its own code", () => {
    for (const { id } of PLATFORM_LANGUAGES) {
      expect(matchPlatformLanguage(id)).toBe(id)
      expect(matchPlatformLanguage([`${id.toUpperCase()}-xx`])).toBe(id)
    }
  })

  it("is English when the platform has none of the languages", () => {
    expect(matchPlatformLanguage("sv,nb;q=0.8,fi;q=0.5")).toBe("en")
    expect(matchPlatformLanguage(["tr", "pl"])).toBe("en")
  })

  it("is English when the browser says nothing", () => {
    for (const nothing of [undefined, null, "", " ", [], [""]]) expect(matchPlatformLanguage(nothing)).toBe("en")
  })

  it("puts the languages of a header in the order of their weights, and in the order of the header for the same weight", () => {
    expect(matchPlatformLanguage("fr;q=0.5,de;q=0.9")).toBe("de")
    expect(matchPlatformLanguage("fr;q=0.8,de;q=0.8")).toBe("fr")
    expect(matchPlatformLanguage("fr;q=0.8,de")).toBe("de")
    expect(matchPlatformLanguage("fr ; q = 0.4 , es ; Q=0.6")).toBe("es")
  })

  it("leaves out a weight of 0 (not this one), the wildcard, and a weight that is not a number", () => {
    expect(matchPlatformLanguage("fr;q=0,de")).toBe("de")
    expect(matchPlatformLanguage("fr;q=0")).toBe("en")
    expect(matchPlatformLanguage("*,es;q=0.5")).toBe("es")
    expect(matchPlatformLanguage("*")).toBe("en")
    expect(matchPlatformLanguage("fr;q=abc,ru")).toBe("ru")
  })

  it("does not choke on a header that is garbage", () => {
    expect(matchPlatformLanguage(";;;,,,")).toBe("en")
    expect(matchPlatformLanguage("-,_,;q=1")).toBe("en")
  })
})

describe("the language an account keeps", () => {
  it("is read from a key of ours, which no provider writes", () => {
    expect(LANGUAGE_KEY).toBe("pbgo_locale")
    expect(LANGUAGE_KEY).not.toBe("locale")
    expect(languageOf({ user_metadata: { pbgo_locale: "ja" } })).toBe("ja")
    expect(languageOf({ user_metadata: { pbgo_locale: "en-GB" } })).toBe("en-GB")
  })

  it("is not the `locale` a provider may fill in, nor a value that is not a language of the platform", () => {
    expect(languageOf({ user_metadata: { locale: "fr", full_name: "Oré" } })).toBeNull()
    expect(languageOf({ user_metadata: { pbgo_locale: "xx" } })).toBeNull()
    expect(languageOf({ user_metadata: { pbgo_locale: "FR" } })).toBeNull()
    expect(languageOf({ user_metadata: { pbgo_locale: "en-gb" } })).toBeNull()
    expect(languageOf({ user_metadata: { pbgo_locale: 42 } })).toBeNull()
    expect(languageOf({ user_metadata: { pbgo_locale: null } })).toBeNull()
  })

  it("is none for an account that has no metadata", () => {
    expect(languageOf({})).toBeNull()
    expect(languageOf({ user_metadata: null })).toBeNull()
    expect(languageOf({ user_metadata: {} })).toBeNull()
  })
})

describe("the cookie of the language", () => {
  it("is the cookie the games have always read, written the way the picker always wrote it", () => {
    expect(LANGUAGE_COOKIE).toBe("pbgo-locale")
    expect(languageCookie("ja")).toBe("pbgo-locale=ja; path=/; max-age=31536000; samesite=lax")
    expect(languageCookie("en-GB")).toBe("pbgo-locale=en-GB; path=/; max-age=31536000; samesite=lax")
  })

  it("is found among the other cookies", () => {
    expect(languageFromCookies("a=1; pbgo-locale=de; b=2")).toBe("de")
    expect(languageFromCookies("pbgo-locale=ko")).toBe("ko")
    expect(languageFromCookies("a=1;pbgo-locale=zh")).toBe("zh")
    expect(languageFromCookies("a=1; pbgo-locale=en-GB; b=2")).toBe("en-GB")
  })

  it("is none when it is absent, when it is not a language of the platform, or when the name is only part of another", () => {
    expect(languageFromCookies("")).toBeNull()
    expect(languageFromCookies("a=1; b=2")).toBeNull()
    expect(languageFromCookies("pbgo-locale=xx")).toBeNull()
    expect(languageFromCookies("pbgo-locale=")).toBeNull()
    expect(languageFromCookies("pbgo-locale")).toBeNull()
    expect(languageFromCookies("x-pbgo-locale=de")).toBeNull()
    expect(languageFromCookies("pbgo-locale-old=de")).toBeNull()
    expect(languageFromCookies("pbgo-locale=en-gb")).toBeNull()
  })
})

describe("hasSessionCookie", () => {
  it("sees the session of Supabase Auth, whole or in chunks", () => {
    expect(hasSessionCookie("sb-abcdefgh-auth-token=base64-eyJ")).toBe(true)
    expect(hasSessionCookie("a=1; sb-abcdefgh-auth-token.0=aaa; sb-abcdefgh-auth-token.1=bbb")).toBe(true)
    expect(hasSessionCookie("pbgo-locale=fr;sb-127-auth-token=x")).toBe(true)
  })

  it("does not take anything else for a session", () => {
    expect(hasSessionCookie("")).toBe(false)
    expect(hasSessionCookie("pbgo-locale=fr; pbgo_demo_account=1")).toBe(false)
    expect(hasSessionCookie("sb-abcdefgh-auth-token-code-verifier=abc")).toBe(false)
    expect(hasSessionCookie("xsb-abcdefgh-auth-token=abc")).toBe(false)
    expect(hasSessionCookie("courtisans_player=sb-abc-auth-token=1")).toBe(false)
  })
})

describe("resolveLanguage", () => {
  it("is the account's, else the cookie's, else the browser's, else English", () => {
    expect(resolveLanguage({ account: "ja", cookie: "de", browser: "fr" })).toBe("ja")
    expect(resolveLanguage({ account: null, cookie: "de", browser: "fr" })).toBe("de")
    expect(resolveLanguage({ cookie: "de", browser: ["fr"] })).toBe("de")
    expect(resolveLanguage({ account: null, cookie: undefined, browser: ["fr-CA", "en"] })).toBe("fr")
    expect(resolveLanguage({ cookie: "en-GB", browser: ["fr"] })).toBe("en-GB")
    expect(resolveLanguage({ cookie: "en", browser: ["en-GB"] })).toBe("en")
    expect(resolveLanguage({ browser: ["en-GB", "en"] })).toBe("en-GB")
    expect(resolveLanguage({ account: "en-GB", cookie: "en", browser: ["en-US"] })).toBe("en-GB")
    expect(resolveLanguage({ browser: "sv" })).toBe("en")
    expect(resolveLanguage({})).toBe("en")
  })

  it("skips a cookie that holds no language of the platform", () => {
    expect(resolveLanguage({ cookie: "xx", browser: "pt-BR" })).toBe("pt")
    expect(resolveLanguage({ cookie: 3, browser: "ko" })).toBe("ko")
    expect(resolveLanguage({ cookie: null })).toBe("en")
  })
})

describe("planLanguage", () => {
  it("makes the account take the language in use at its first sign-in: the cookie's", () => {
    expect(planLanguage({ account: null, cookie: "de", browser: ["fr"] })).toEqual({ language: "de", writeCookie: false, writeAccount: true, refresh: false })
  })

  it("makes it take the browser's when the device has no cookie, and writes that on the device too", () => {
    expect(planLanguage({ account: null, cookie: null, browser: ["ja-JP", "en"] })).toEqual({ language: "ja", writeCookie: true, writeAccount: true, refresh: false })
  })

  it("makes it take English when there is neither a cookie nor a language of the browser that the platform has", () => {
    expect(planLanguage({ account: undefined, cookie: undefined, browser: ["sv"] })).toEqual({ language: "en", writeCookie: true, writeAccount: true, refresh: false })
  })

  it("lets the account win on another device, whose cookie says something else: the cookie is rewritten and the page drawn again", () => {
    expect(planLanguage({ account: "fr", cookie: "de", browser: ["de"] })).toEqual({ language: "fr", writeCookie: true, writeAccount: false, refresh: true })
  })

  it("lets the account win on a device that has no cookie yet", () => {
    expect(planLanguage({ account: "fr", cookie: null, browser: ["fr-FR"] })).toEqual({ language: "fr", writeCookie: true, writeAccount: false, refresh: false })
    expect(planLanguage({ account: "fr", cookie: null, browser: ["en-US"] })).toEqual({ language: "fr", writeCookie: true, writeAccount: false, refresh: true })
  })

  it("does nothing when the cookie already says what the account says", () => {
    expect(planLanguage({ account: "ko", cookie: "ko", browser: ["en"] })).toEqual({ language: "ko", writeCookie: false, writeAccount: false, refresh: false })
  })

  it("rewrites a cookie that holds something that is not a language", () => {
    expect(planLanguage({ account: "es", cookie: "xx", browser: ["es"] })).toMatchObject({ language: "es", writeCookie: true, writeAccount: false })
    expect(planLanguage({ account: null, cookie: "xx", browser: ["pt-BR"] })).toMatchObject({ language: "pt", writeCookie: true, writeAccount: true })
  })

  it("makes the account take English (UK) when that is what the browser asks for, and keeps English (US) when the cookie says so", () => {
    expect(planLanguage({ account: null, cookie: null, browser: ["en-GB", "en"] })).toEqual({ language: "en-GB", writeCookie: true, writeAccount: true, refresh: false })
    expect(planLanguage({ account: null, cookie: "en", browser: ["en-GB"] })).toEqual({ language: "en", writeCookie: false, writeAccount: true, refresh: false })
  })

  it("lets the account's English (UK) win on a device whose cookie says English (US): the cookie is rewritten and the page drawn again", () => {
    expect(planLanguage({ account: "en-GB", cookie: "en", browser: ["en-US"] })).toEqual({ language: "en-GB", writeCookie: true, writeAccount: false, refresh: true })
  })

  it("never writes the account once it keeps a language: only a choice does", () => {
    for (const cookie of [null, "de", "xx", "fr"]) for (const browser of [[], ["fr"], ["ja"]]) expect(planLanguage({ account: "fr", cookie, browser }).writeAccount).toBe(false)
  })
})
