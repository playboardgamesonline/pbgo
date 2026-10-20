import { LANGUAGES } from "@pbgo/studio-kit/constants"
import { describe, expect, it } from "vitest"
import { cookieValue, isLocale, LOCALE_COOKIE, pickLocale } from "./locale"
import { BANNER_TEXTS } from "./texts"

describe("cookieValue", () => {
  it("finds a cookie among others", () => {
    expect(cookieValue("a=1; pbgo-locale=de; b=2", "pbgo-locale")).toBe("de")
    expect(cookieValue("pbgo-locale=es", "pbgo-locale")).toBe("es")
    expect(cookieValue("a=1;pbgo-locale=fr", "pbgo-locale")).toBe("fr")
  })

  it("is undefined when absent, and does not match a longer name", () => {
    expect(cookieValue("", "pbgo-locale")).toBeUndefined()
    expect(cookieValue("a=1; b=2", "pbgo-locale")).toBeUndefined()
    expect(cookieValue("x-pbgo-locale=de", "pbgo-locale")).toBeUndefined()
    expect(cookieValue("pbgo-locale", "pbgo-locale")).toBeUndefined()
  })

  it("decodes the value, and keeps a malformed one as it is", () => {
    expect(cookieValue("k=a%20b", "k")).toBe("a b")
    expect(cookieValue("k=%E0%A4%A", "k")).toBe("%E0%A4%A")
  })
})

describe("pickLocale", () => {
  it("follows the cookie first", () => {
    expect(pickLocale({ cookie: "de", languages: ["fr-FR"] })).toBe("de")
  })

  it("ignores a cookie that is not a language of the site", () => {
    expect(pickLocale({ cookie: "xx", languages: ["es-MX", "en"] })).toBe("es")
  })

  it("takes the first language of the browser that the site speaks", () => {
    expect(pickLocale({ languages: ["pt-BR", "de-AT", "fr"] })).toBe("de")
    expect(pickLocale({ languages: ["FR-ca"] })).toBe("fr")
  })

  it("is English when none is supported, French when the browser says nothing", () => {
    expect(pickLocale({ languages: ["ja", "pt-BR"] })).toBe("en")
    expect(pickLocale({ languages: [] })).toBe("fr")
    expect(pickLocale({})).toBe("fr")
  })
})

describe("languages", () => {
  it("keeps the cookie name of the site", () => {
    expect(LOCALE_COOKIE).toBe("pbgo-locale")
  })

  it("has a banner text for every language of the site, and for nothing else", () => {
    const ids = LANGUAGES.map((language) => language.id)
    expect(Object.keys(BANNER_TEXTS).sort()).toEqual([...ids].sort())
    for (const id of ids) {
      expect(isLocale(id)).toBe(true)
      for (const [name, text] of Object.entries(BANNER_TEXTS[id])) {
        expect(text.trim().length, `${id}.${name}`).toBeGreaterThan(0)
      }
    }
  })

  it("gives the two answers a different label in each language", () => {
    for (const texts of Object.values(BANNER_TEXTS)) {
      expect(texts.accept).not.toBe(texts.refuse)
    }
  })
})
