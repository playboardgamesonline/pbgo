import { describe, expect, it, vi } from "vitest"
import { DEMO_ACCOUNT } from "./demo"
import { MOTION_ATTRIBUTE, MOTION_COOKIE, MOTION_COOKIE_MAX_AGE, MOTION_SCRIPT, applyMotion, motionCookie, motionFromCookies, motionOf, syncMotion, type MotionDocument } from "./motion"
import { PREFERENCE_KEYS } from "./preferences"

/** A document with a cookie jar and an `<html>` that keeps its attributes, as far as the module touches them. */
function fakeDocument(cookie = ""): MotionDocument & { attributes: Map<string, string> } {
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
  it("are the platform's own: a cookie of its own, and an attribute that says what it is for", () => {
    expect(MOTION_COOKIE).toBe("pbgo-motion")
    expect(MOTION_ATTRIBUTE).toBe("data-reduce-motion")
    expect(PREFERENCE_KEYS.reduceMotion).toBe("pbgo_reduce_motion")
  })
})

describe("motionCookie", () => {
  it("keeps `always` and `never` for a year, for every page of the site", () => {
    expect(motionCookie("always")).toBe(`pbgo-motion=always; path=/; max-age=${MOTION_COOKIE_MAX_AGE}; samesite=lax`)
    expect(motionCookie("never")).toBe(`pbgo-motion=never; path=/; max-age=${MOTION_COOKIE_MAX_AGE}; samesite=lax`)
    expect(MOTION_COOKIE_MAX_AGE).toBe(365 * 24 * 60 * 60)
  })

  it("takes the cookie away for `auto`, which is the device's to decide", () => {
    expect(motionCookie("auto")).toBe("pbgo-motion=; path=/; max-age=0; samesite=lax")
  })
})

describe("motionFromCookies and motionOf", () => {
  it("read the choice a cookie holds", () => {
    expect(motionFromCookies("pbgo-motion=always")).toBe("always")
    expect(motionFromCookies("a=1; pbgo-motion=never; b=2")).toBe("never")
    expect(motionFromCookies("pbgo-locale=fr;   pbgo-motion = always ")).toBe("always")
  })

  it("read `auto` for no cookie, an empty one, or a value that is not a choice: the cookie is writable by anyone", () => {
    expect(motionFromCookies("")).toBe("auto")
    expect(motionFromCookies("pbgo-locale=fr")).toBe("auto")
    expect(motionFromCookies("pbgo-motion=")).toBe("auto")
    expect(motionFromCookies("pbgo-motion=auto")).toBe("auto")
    expect(motionFromCookies("pbgo-motion=sometimes")).toBe("auto")
    expect(motionFromCookies("xpbgo-motion=always")).toBe("auto")
    expect(motionOf("always")).toBe("always")
    expect(motionOf("never")).toBe("never")
    expect(motionOf(undefined)).toBe("auto")
    expect(motionOf("ALWAYS")).toBe("auto")
  })
})

describe("applyMotion", () => {
  it("puts a choice into effect at once, on the page, and keeps it for the next one", () => {
    const doc = fakeDocument()
    applyMotion("always", doc)
    expect(doc.attributes.get("data-reduce-motion")).toBe("always")
    expect(motionFromCookies(doc.cookie)).toBe("always")
    applyMotion("never", doc)
    expect(doc.attributes.get("data-reduce-motion")).toBe("never")
    expect(doc.cookie).toBe(motionCookie("never"))
  })

  it("takes the attribute away for `auto`, and the cookie with it", () => {
    const doc = fakeDocument()
    applyMotion("always", doc)
    applyMotion("auto", doc)
    expect(doc.attributes.has("data-reduce-motion")).toBe(false)
    expect(doc.cookie).toBe(motionCookie("auto"))
  })
})

describe("MOTION_SCRIPT, the script of the head of every page", () => {
  /** Runs the script as a browser would: with a `document` that holds a cookie string and an `<html>`. */
  function run(cookie: string): Map<string, string> {
    const doc = fakeDocument(cookie)
    new Function("document", MOTION_SCRIPT)(doc)
    return doc.attributes
  }

  it("copies the choice of the cookie onto `<html>` before the first paint", () => {
    expect(run("pbgo-motion=always").get("data-reduce-motion")).toBe("always")
    expect(run("a=1; pbgo-motion=never").get("data-reduce-motion")).toBe("never")
    expect(run("pbgo-locale=fr; pbgo-motion=always; b=2").get("data-reduce-motion")).toBe("always")
  })

  it("does nothing for a device with no cookie, with `auto`, or with a value that is not a choice", () => {
    for (const cookie of ["", "pbgo-locale=fr", "pbgo-motion=", "pbgo-motion=auto", "pbgo-motion=sometimes", "xpbgo-motion=always", "pbgo-motion-x=always"]) {
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
    expect(() => new Function("document", MOTION_SCRIPT)(doc)).not.toThrow()
    expect(doc.documentElement.setAttribute).not.toHaveBeenCalled()
  })

  it("is the one statement of the module's own names: it has no other cookie and no other attribute", () => {
    expect(MOTION_SCRIPT).toContain(MOTION_COOKIE)
    expect(MOTION_SCRIPT).toContain(MOTION_ATTRIBUTE)
    expect(MOTION_SCRIPT).not.toContain("${")
    expect(MOTION_SCRIPT.length).toBeLessThan(300)
  })
})

describe("syncMotion", () => {
  const member = (reduceMotion: "auto" | "always" | "never") => ({ status: "signed-in" as const, account: { id: "11111111-2222-4333-8444-555555555555", preferences: { reduceMotion } } })

  it("writes the choice of the account on a device that holds another, the account winning", () => {
    const apply = vi.fn()
    expect(syncMotion(member("always"), "", apply)).toBe("always")
    expect(syncMotion(member("never"), "pbgo-motion=always", apply)).toBe("never")
    expect(apply.mock.calls).toEqual([["always"], ["never"]])
  })

  it("takes the choice away from a device when the account says `auto`, which is a choice like the others", () => {
    const apply = vi.fn()
    expect(syncMotion(member("auto"), "pbgo-motion=always", apply)).toBe("auto")
    expect(apply).toHaveBeenCalledWith("auto")
  })

  it("writes nothing when the device already holds the account's choice, so it can run as often as the session is read", () => {
    const apply = vi.fn()
    expect(syncMotion(member("always"), "pbgo-motion=always", apply)).toBeNull()
    expect(syncMotion(member("auto"), "", apply)).toBeNull()
    expect(syncMotion(member("auto"), "pbgo-motion=sometimes", apply)).toBeNull()
    expect(apply).not.toHaveBeenCalled()
  })

  it("leaves the device alone for a visitor the browser has not read yet, for a guest, and for the demo account, which keeps nothing", () => {
    const apply = vi.fn()
    expect(syncMotion({ status: "loading" }, "pbgo-motion=always", apply)).toBeNull()
    expect(syncMotion({ status: "signed-out" }, "pbgo-motion=always", apply)).toBeNull()
    expect(syncMotion({ status: "signed-in", account: DEMO_ACCOUNT }, "pbgo-motion=always", apply)).toBeNull()
    expect(apply).not.toHaveBeenCalled()
  })
})
