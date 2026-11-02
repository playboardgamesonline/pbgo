import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The account is behind `./client`, which the setter loads only for a visitor who holds a session: here it is a stub
const { saveLanguage } = vi.hoisted(() => ({ saveLanguage: vi.fn() }))
vi.mock("./client", () => ({ saveLanguage }))

import { DEMO_ACCOUNT, isDemoAccount } from "./demo"
import { applyLanguage, syncLanguage, type LanguageEffects, type SyncedVisitor } from "./language-sync"
import type { PlatformLanguage } from "./language"
import { setLanguage } from "./set-language"

/** A `document` that is only a cookie jar. */
function jar(initial: string) {
  const cookies = new Map(initial.split("; ").filter(Boolean).map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)] as const))
  vi.stubGlobal("document", {
    get cookie() {
      return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ")
    },
    set cookie(line: string) {
      const [pair = ""] = line.split(";")
      cookies.set(pair.slice(0, pair.indexOf("=")).trim(), pair.slice(pair.indexOf("=") + 1))
    },
  })
}

beforeEach(() => {
  saveLanguage.mockClear()
  saveLanguage.mockImplementation(async () => "saved")
})
afterEach(() => vi.unstubAllGlobals())

describe("applyLanguage", () => {
  const effects = (): LanguageEffects & { calls: string[] } => {
    const calls: string[] = []
    return {
      calls,
      writeCookie: (language) => void calls.push(`cookie:${language}`),
      saveAccount: (language) => void calls.push(`account:${language}`),
      refresh: () => void calls.push("refresh"),
    }
  }

  it("makes an account that keeps no language take the one in use, at its first sign-in: the cookie's", () => {
    const e = effects()
    applyLanguage({ account: null, cookie: "de", browser: ["fr"] }, e)
    expect(e.calls).toEqual(["account:de"])
  })

  it("makes it take the browser's on a device with no cookie, and writes the cookie too without drawing the page again", () => {
    const e = effects()
    applyLanguage({ account: null, cookie: null, browser: ["ja-JP", "en"] }, e)
    expect(e.calls).toEqual(["cookie:ja", "account:ja"])
  })

  it("lets the account win on another device: the cookie is rewritten, the page drawn again, the account left alone", () => {
    const e = effects()
    applyLanguage({ account: "fr", cookie: "de", browser: ["de"] }, e)
    expect(e.calls).toEqual(["cookie:fr", "refresh"])
  })

  it("does nothing when the device already agrees with the account, however often the session is read", () => {
    const e = effects()
    for (let read = 0; read < 3; read += 1) applyLanguage({ account: "ko", cookie: "ko", browser: ["en"] }, e)
    expect(e.calls).toEqual([])
  })

  it("settles after one round: what it writes is what the next read finds", () => {
    const e = effects()
    const first = applyLanguage({ account: null, cookie: "xx", browser: ["pt-BR"] }, e)
    expect(first).toMatchObject({ language: "pt", writeCookie: true, writeAccount: true })
    applyLanguage({ account: first.language, cookie: first.language, browser: ["pt-BR"] }, e)
    expect(e.calls).toEqual(["cookie:pt", "account:pt"])
  })

  it("returns the plan it applied", () => {
    expect(applyLanguage({ account: "es", cookie: null, browser: [] }, effects())).toEqual({ language: "es", writeCookie: true, writeAccount: false, refresh: true })
  })
})

describe("syncLanguage", () => {
  const effects = (): LanguageEffects & { calls: string[] } => {
    const calls: string[] = []
    return {
      calls,
      writeCookie: (language) => void calls.push(`cookie:${language}`),
      saveAccount: (language) => void calls.push(`account:${language}`),
      refresh: () => void calls.push("refresh"),
    }
  }
  const where = (cookies: string, languages: string[] = ["fr-FR", "en"]) => ({ cookies, languages })
  const real = (language: PlatformLanguage | null): SyncedVisitor => ({ status: "signed-in", account: { id: "5d1f0c2e-3b4a-4c6d-8e7f-9a0b1c2d3e4f", language } })

  it("waits for the browser to have read the session, and does nothing for a guest", () => {
    const e = effects()
    expect(syncLanguage({ status: "loading" }, where(""), e)).toBeNull()
    expect(syncLanguage({ status: "signed-out" }, where("pbgo-locale=de"), e)).toBeNull()
    expect(e.calls).toEqual([])
  })

  it("does nothing for the demo account of development, which keeps its language in the cookie alone", () => {
    const e = effects()
    const demo: SyncedVisitor = { status: "signed-in", account: { id: DEMO_ACCOUNT.id, language: DEMO_ACCOUNT.language } }
    expect(isDemoAccount(DEMO_ACCOUNT)).toBe(true)
    expect(syncLanguage(demo, where("pbgo-locale=de"), e)).toBeNull()
    expect(syncLanguage(demo, where(""), e)).toBeNull()
    expect(e.calls).toEqual([])
  })

  it("makes the first sign-in of an account keep the language in use: the cookie's, else the browser's", () => {
    const withCookie = effects()
    syncLanguage(real(null), where("a=1; pbgo-locale=de"), withCookie)
    expect(withCookie.calls).toEqual(["account:de"])

    const withoutCookie = effects()
    syncLanguage(real(null), where("a=1", ["pt-BR", "en"]), withoutCookie)
    expect(withoutCookie.calls).toEqual(["cookie:pt", "account:pt"])
  })

  it("lets the account win on a device that holds another language, and draws the page again", () => {
    const e = effects()
    syncLanguage(real("ja"), where("pbgo-locale=fr"), e)
    expect(e.calls).toEqual(["cookie:ja", "refresh"])
  })

  it("does nothing once the device and the account agree", () => {
    const e = effects()
    syncLanguage(real("ja"), where("pbgo-locale=ja"), e)
    expect(e.calls).toEqual([])
  })

  it("leaves the cookie alone while a change is on its way, or it would undo the choice before the account has heard of it", async () => {
    jar("sb-abcdef-auth-token=session")
    const e = effects()
    let during: unknown
    saveLanguage.mockImplementationOnce(async () => {
      during = syncLanguage(real("fr"), where("pbgo-locale=de"), e)
      return "saved"
    })
    await setLanguage("de")
    expect(during).toBeNull()
    expect(e.calls).toEqual([])
    expect(syncLanguage(real("fr"), where("pbgo-locale=de"), e)).not.toBeNull()
  })
})
