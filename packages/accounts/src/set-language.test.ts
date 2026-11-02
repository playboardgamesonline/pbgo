import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The account is behind `./client`, which the setter loads only for a visitor who holds a session: here it is a stub that records when it is asked
const { saveLanguage } = vi.hoisted(() => ({ saveLanguage: vi.fn() }))
vi.mock("./client", () => ({ saveLanguage }))

import { isChangingLanguage, setLanguage } from "./set-language"

const COOKIE = "pbgo-locale=de; path=/; max-age=31536000; samesite=lax"

/** A `document` that is only a cookie jar, and the lines written to it. */
function jar(initial: string, log: string[] = []) {
  const cookies = new Map(initial.split("; ").filter(Boolean).map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)] as const))
  const writes: string[] = []
  vi.stubGlobal("document", {
    get cookie() {
      return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ")
    },
    set cookie(line: string) {
      writes.push(line)
      log.push("cookie")
      const [pair = ""] = line.split(";")
      cookies.set(pair.slice(0, pair.indexOf("=")).trim(), pair.slice(pair.indexOf("=") + 1))
    },
  })
  return { writes, cookies }
}

beforeEach(() => {
  saveLanguage.mockClear()
  saveLanguage.mockImplementation(async () => "saved")
})
afterEach(() => vi.unstubAllGlobals())

describe("setLanguage", () => {
  it("keeps the cookie alone for a guest, and never goes near the account", async () => {
    const { writes } = jar("a=1; courtisans_player=abc")
    expect(await setLanguage("de")).toBe("device")
    expect(writes).toEqual([COOKIE])
    expect(saveLanguage).not.toHaveBeenCalled()
  })

  it("keeps the cookie alone for the demo account of development, which has a cookie and no session", async () => {
    const { writes } = jar("pbgo_demo_account=1")
    expect(await setLanguage("de")).toBe("device")
    expect(writes).toEqual([COOKIE])
    expect(saveLanguage).not.toHaveBeenCalled()
  })

  it("writes the account first and the cookie once the account holds the language", async () => {
    const order: string[] = []
    const { writes } = jar("sb-abcdef-auth-token=session", order)
    saveLanguage.mockImplementation(async (language: string) => {
      order.push(`account:${language}`)
      return "saved"
    })
    expect(await setLanguage("de")).toBe("account")
    expect(order).toEqual(["account:de", "cookie"])
    expect(writes).toEqual([COOKIE])
  })

  it("keeps the cookie alone when a session cookie is there but the client finds no session", async () => {
    const { writes } = jar("sb-abcdef-auth-token=expired")
    saveLanguage.mockResolvedValue("no-session")
    expect(await setLanguage("de")).toBe("device")
    expect(writes).toEqual([COOKIE])
  })

  it("changes nothing when the account cannot be written: the cookie would be undone by the account at the next sync", async () => {
    const { writes, cookies } = jar("sb-abcdef-auth-token=session; pbgo-locale=fr")
    saveLanguage.mockResolvedValue("failed")
    expect(await setLanguage("de")).toBe("failed")
    expect(writes).toEqual([])
    expect(cookies.get("pbgo-locale")).toBe("fr")
  })

  it("changes nothing when the account cannot even be reached", async () => {
    const { writes } = jar("sb-abcdef-auth-token.0=session")
    saveLanguage.mockImplementation(() => {
      throw new Error("network down")
    })
    expect(await setLanguage("de")).toBe("failed")
    expect(writes).toEqual([])
  })

  it("says that a change is on its way, and that it is over when it ends well or badly", async () => {
    jar("sb-abcdef-auth-token=session")
    let during: boolean | undefined
    saveLanguage.mockImplementationOnce(async () => {
      during = isChangingLanguage()
      return "saved"
    })
    expect(isChangingLanguage()).toBe(false)
    await setLanguage("ja")
    expect(during).toBe(true)
    expect(isChangingLanguage()).toBe(false)

    saveLanguage.mockImplementationOnce(() => {
      throw new Error("no")
    })
    await setLanguage("ja")
    expect(isChangingLanguage()).toBe(false)
  })

  it("accepts each of the twelve languages", async () => {
    const { writes } = jar("")
    for (const language of ["en", "fr", "es", "de", "zh", "ja", "ru", "ar", "bn", "hi", "pt", "ko"] as const) await setLanguage(language)
    expect(writes.map((line) => line.split(";")[0])).toEqual(["en", "fr", "es", "de", "zh", "ja", "ru", "ar", "bn", "hi", "pt", "ko"].map((id) => `pbgo-locale=${id}`))
  })
})
