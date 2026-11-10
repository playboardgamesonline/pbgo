import { describe, expect, it, vi } from "vitest"
import { DEMO_ACCOUNT } from "./demo"
import {
  DISPLAY_COOKIE_MAX_AGE,
  DISPLAY_NAMES,
  DISPLAY_SCRIPT,
  DISPLAY_SETTINGS,
  MOTION_ATTRIBUTE,
  TRANSPARENCY_ATTRIBUTE,
  applyDisplay,
  displayChoiceOf,
  displayCookie,
  displayFromCookies,
  syncDisplay,
  type DisplayDocument,
  type DisplaySetting,
} from "./display"
import { PREFERENCE_KEYS, type ReduceChoice } from "./preferences"

/** A document with a cookie jar and an `<html>` that keeps its attributes, as far as the module touches them. */
function fakeDocument(cookie = ""): DisplayDocument & { attributes: Map<string, string> } {
  const attributes = new Map<string, string>()
  return {
    cookie,
    attributes,
    documentElement: {
      setAttribute: (name, value) => void attributes.set(name, value),
      removeAttribute: (name) => void attributes.delete(name),
    },
  }
}

describe("the names", () => {
  it("are the platform's own: a cookie of its own and an attribute that says what it is for, for each setting", () => {
    expect(DISPLAY_SETTINGS.reduceMotion).toEqual({ cookie: "pbgo-motion", attribute: "data-reduce-motion" })
    expect(DISPLAY_SETTINGS.reduceTransparency).toEqual({ cookie: "pbgo-transparency", attribute: "data-reduce-transparency" })
    expect(MOTION_ATTRIBUTE).toBe("data-reduce-motion")
    expect(TRANSPARENCY_ATTRIBUTE).toBe("data-reduce-transparency")
  })

  it("are one cookie and one attribute for each setting, and one key of the account for each, none of them shared", () => {
    expect(new Set(DISPLAY_NAMES.map((name) => DISPLAY_SETTINGS[name].cookie)).size).toBe(DISPLAY_NAMES.length)
    expect(new Set(DISPLAY_NAMES.map((name) => DISPLAY_SETTINGS[name].attribute)).size).toBe(DISPLAY_NAMES.length)
    for (const name of DISPLAY_NAMES) expect(PREFERENCE_KEYS[name]).toMatch(/^pbgo_/)
    expect(PREFERENCE_KEYS.reduceMotion).toBe("pbgo_reduce_motion")
    expect(PREFERENCE_KEYS.reduceTransparency).toBe("pbgo_reduce_transparency")
  })
})

describe("displayCookie", () => {
  it("keeps `always` and `never` for a year, for every page of the site", () => {
    expect(displayCookie("reduceMotion", "always")).toBe(`pbgo-motion=always; path=/; max-age=${DISPLAY_COOKIE_MAX_AGE}; samesite=lax`)
    expect(displayCookie("reduceTransparency", "never")).toBe(`pbgo-transparency=never; path=/; max-age=${DISPLAY_COOKIE_MAX_AGE}; samesite=lax`)
    expect(DISPLAY_COOKIE_MAX_AGE).toBe(365 * 24 * 60 * 60)
  })

  it("takes the cookie away for `auto`, which is the device's to decide", () => {
    expect(displayCookie("reduceMotion", "auto")).toBe("pbgo-motion=; path=/; max-age=0; samesite=lax")
    expect(displayCookie("reduceTransparency", "auto")).toBe("pbgo-transparency=; path=/; max-age=0; samesite=lax")
  })
})

describe("displayFromCookies and displayChoiceOf", () => {
  it("read the choice a cookie holds, setting by setting", () => {
    expect(displayFromCookies("reduceMotion", "pbgo-motion=always")).toBe("always")
    expect(displayFromCookies("reduceMotion", "a=1; pbgo-motion=never; b=2")).toBe("never")
    expect(displayFromCookies("reduceMotion", "pbgo-locale=fr;   pbgo-motion = always ")).toBe("always")
    expect(displayFromCookies("reduceTransparency", "pbgo-motion=always; pbgo-transparency=never")).toBe("never")
    expect(displayFromCookies("reduceMotion", "pbgo-motion=always; pbgo-transparency=never")).toBe("always")
  })

  it("read `auto` for no cookie, an empty one, or a value that is not a choice: the cookie is writable by anyone", () => {
    for (const setting of DISPLAY_NAMES) {
      const { cookie } = DISPLAY_SETTINGS[setting]
      for (const cookies of ["", "pbgo-locale=fr", `${cookie}=`, `${cookie}=auto`, `${cookie}=sometimes`, `x${cookie}=always`, `${cookie}-x=always`]) {
        expect(displayFromCookies(setting, cookies), cookies).toBe("auto")
      }
    }
    expect(displayChoiceOf("always")).toBe("always")
    expect(displayChoiceOf("never")).toBe("never")
    expect(displayChoiceOf(undefined)).toBe("auto")
    expect(displayChoiceOf("ALWAYS")).toBe("auto")
  })
})

describe("applyDisplay", () => {
  it("puts a choice into effect at once, on the page, and keeps it for the next one", () => {
    const doc = fakeDocument()
    applyDisplay("reduceMotion", "always", doc)
    expect(doc.attributes.get("data-reduce-motion")).toBe("always")
    expect(displayFromCookies("reduceMotion", doc.cookie)).toBe("always")
    applyDisplay("reduceMotion", "never", doc)
    expect(doc.attributes.get("data-reduce-motion")).toBe("never")
    expect(doc.cookie).toBe(displayCookie("reduceMotion", "never"))
  })

  it("writes the attribute of the setting it is told, and no other", () => {
    const doc = fakeDocument()
    applyDisplay("reduceTransparency", "always", doc)
    expect(doc.attributes.get("data-reduce-transparency")).toBe("always")
    expect(doc.attributes.has("data-reduce-motion")).toBe(false)
    expect(doc.cookie.startsWith("pbgo-transparency=always")).toBe(true)
  })

  it("takes the attribute away for `auto`, and the cookie with it", () => {
    const doc = fakeDocument()
    applyDisplay("reduceMotion", "always", doc)
    applyDisplay("reduceMotion", "auto", doc)
    expect(doc.attributes.has("data-reduce-motion")).toBe(false)
    expect(doc.cookie).toBe(displayCookie("reduceMotion", "auto"))
  })
})

describe("DISPLAY_SCRIPT, the script of the head of every page", () => {
  /** Runs the script as a browser would: with a `document` that holds a cookie string and an `<html>`. */
  function run(cookie: string): Map<string, string> {
    const doc = fakeDocument(cookie)
    new Function("document", DISPLAY_SCRIPT)(doc)
    return doc.attributes
  }

  it("copies each choice of the cookies onto `<html>` before the first paint", () => {
    expect(run("pbgo-motion=always").get("data-reduce-motion")).toBe("always")
    expect(run("a=1; pbgo-motion=never").get("data-reduce-motion")).toBe("never")
    expect(run("pbgo-locale=fr; pbgo-motion=always; b=2").get("data-reduce-motion")).toBe("always")
    expect(run("pbgo-transparency=always").get("data-reduce-transparency")).toBe("always")
    const both = run("pbgo-transparency=never; pbgo-motion=always")
    expect([both.get("data-reduce-motion"), both.get("data-reduce-transparency")]).toEqual(["always", "never"])
  })

  it("writes only the settings that have a cookie", () => {
    const attributes = run("pbgo-transparency=always")
    expect([...attributes.keys()]).toEqual(["data-reduce-transparency"])
  })

  it("does nothing for a device with no cookie, with `auto`, or with a value that is not a choice", () => {
    for (const cookie of ["", "pbgo-locale=fr", "pbgo-motion=", "pbgo-motion=auto", "pbgo-motion=sometimes", "xpbgo-motion=always", "pbgo-motion-x=always", "pbgo-transparency=sometimes"]) {
      expect(run(cookie).size, cookie).toBe(0)
    }
  })

  it("never throws: a page whose cookies cannot be read still draws", () => {
    const doc = {
      get cookie(): string {
        throw new Error("blocked")
      },
      documentElement: { setAttribute: vi.fn() },
    }
    expect(() => new Function("document", DISPLAY_SCRIPT)(doc)).not.toThrow()
    expect(doc.documentElement.setAttribute).not.toHaveBeenCalled()
  })

  it("is the one statement of the module's own names: it has no other cookie and no other attribute", () => {
    for (const name of DISPLAY_NAMES) {
      expect(DISPLAY_SCRIPT).toContain(DISPLAY_SETTINGS[name].cookie)
      expect(DISPLAY_SCRIPT).toContain(DISPLAY_SETTINGS[name].attribute)
    }
    expect(DISPLAY_SCRIPT).not.toContain("${")
    expect(DISPLAY_SCRIPT.length).toBeLessThan(500)
  })
})

describe("syncDisplay", () => {
  const member = (reduceMotion: ReduceChoice, reduceTransparency: ReduceChoice = "auto") => ({
    status: "signed-in" as const,
    account: { id: "11111111-2222-4333-8444-555555555555", preferences: { reduceMotion, reduceTransparency } },
  })
  const applied = () => {
    const calls: [DisplaySetting, ReduceChoice][] = []
    return { calls, apply: (setting: DisplaySetting, choice: ReduceChoice) => void calls.push([setting, choice]) }
  }

  it("writes the choice of the account on a device that holds another, the account winning", () => {
    const { calls, apply } = applied()
    expect(syncDisplay(member("always"), "", apply)).toEqual(["reduceMotion"])
    expect(syncDisplay(member("never"), "pbgo-motion=always", apply)).toEqual(["reduceMotion"])
    expect(calls).toEqual([["reduceMotion", "always"], ["reduceMotion", "never"]])
  })

  it("goes through every setting: each is written when its own cookie differs", () => {
    const { calls, apply } = applied()
    expect(syncDisplay(member("always", "never"), "pbgo-motion=always", apply)).toEqual(["reduceTransparency"])
    expect(syncDisplay(member("always", "never"), "", apply)).toEqual(["reduceMotion", "reduceTransparency"])
    expect(calls).toEqual([["reduceTransparency", "never"], ["reduceMotion", "always"], ["reduceTransparency", "never"]])
  })

  it("takes the choice away from a device when the account says `auto`, which is a choice like the others", () => {
    const { calls, apply } = applied()
    expect(syncDisplay(member("auto"), "pbgo-motion=always", apply)).toEqual(["reduceMotion"])
    expect(calls).toEqual([["reduceMotion", "auto"]])
  })

  it("writes nothing when the device already holds the account's choices, so it can run as often as the session is read", () => {
    const { calls, apply } = applied()
    expect(syncDisplay(member("always", "never"), "pbgo-motion=always; pbgo-transparency=never", apply)).toEqual([])
    expect(syncDisplay(member("auto"), "", apply)).toEqual([])
    expect(syncDisplay(member("auto"), "pbgo-motion=sometimes", apply)).toEqual([])
    expect(calls).toEqual([])
  })

  it("leaves the device alone for a visitor the browser has not read yet, for a guest, and for the demo account, which keeps nothing", () => {
    const { calls, apply } = applied()
    expect(syncDisplay({ status: "loading" }, "pbgo-motion=always", apply)).toEqual([])
    expect(syncDisplay({ status: "signed-out" }, "pbgo-motion=always", apply)).toEqual([])
    expect(syncDisplay({ status: "signed-in", account: DEMO_ACCOUNT }, "pbgo-motion=always", apply)).toEqual([])
    expect(calls).toEqual([])
  })
})
