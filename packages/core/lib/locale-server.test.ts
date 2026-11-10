import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

// What the request holds: the cookies and the headers `getLocale` reads
const request = vi.hoisted(() => ({ cookie: undefined as string | undefined, acceptLanguage: null as string | null, broken: false }))
vi.mock("next/headers", () => ({
  cookies: async () => {
    if (request.broken) throw new Error("outside of a request")
    return { get: (name: string) => (name === "pbgo-locale" && request.cookie !== undefined ? { name, value: request.cookie } : undefined) }
  },
  headers: async () => ({ get: (name: string) => (name === "accept-language" ? request.acceptLanguage : null) }),
}))

import { getLocale } from "./locale-server"

beforeEach(() => {
  request.cookie = undefined
  request.acceptLanguage = null
  request.broken = false
})

describe("getLocale", () => {
  it("is the cookie's language when the games have it", async () => {
    request.cookie = "de"
    request.acceptLanguage = "fr-FR"
    expect(await getLocale()).toBe("de")
  })

  it("is English when the visitor's language is one of the platform's that the games do not have (English (UK) among them), whatever the browser comes second with", async () => {
    request.acceptLanguage = "ja,fr;q=0.8"
    for (const language of ["en-GB", "zh", "ja", "ru", "ar", "bn", "hi", "pt", "ko"]) {
      request.cookie = language
      expect(await getLocale()).toBe("en")
    }
  })

  it("follows the browser when the cookie holds nothing the platform speaks", async () => {
    request.cookie = "klingon"
    request.acceptLanguage = "es-MX,es;q=0.9"
    expect(await getLocale()).toBe("es")
  })

  it("follows the browser without a cookie: its language when the games have it, English when they lack it", async () => {
    request.acceptLanguage = "de-AT"
    expect(await getLocale()).toBe("de")
    request.acceptLanguage = "ja"
    expect(await getLocale()).toBe("en")
  })

  it("is English when the request has no Accept-Language at all (a crawler), the default language of the site", async () => {
    request.acceptLanguage = null
    expect(await getLocale()).toBe("en")
    request.cookie = "xx"
    expect(await getLocale()).toBe("en")
  })

  it("is English outside of a request", async () => {
    request.broken = true
    expect(await getLocale()).toBe("en")
  })
})
