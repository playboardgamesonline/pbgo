import { describe, expect, it } from "vitest"
import { debugAllowed, debugAsked, debugKeyToggles, debugLoadsAlone } from "./debug-rule"

/** The environments a deployment can be in: `VERCEL_ENV`, or nothing where Vercel is not involved (`next.config.ts` then says `development`) */
const OUTSIDE_PRODUCTION = ["preview", "development", undefined]

describe("where the debug tools may run", () => {
  it("never on the production deployment", () => {
    expect(debugAllowed("production")).toBe(false)
  })

  it.each(OUTSIDE_PRODUCTION)("on %s", (env) => {
    expect(debugAllowed(env)).toBe(true)
  })

  it("reads NEXT_PUBLIC_APP_ENV when no environment is given", () => {
    const before = process.env.NEXT_PUBLIC_APP_ENV
    try {
      process.env.NEXT_PUBLIC_APP_ENV = "production"
      expect(debugAllowed()).toBe(false)
      process.env.NEXT_PUBLIC_APP_ENV = "preview"
      expect(debugAllowed()).toBe(true)
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_APP_ENV
      else process.env.NEXT_PUBLIC_APP_ENV = before
    }
  })
})

describe("?debug and the flag in the storage", () => {
  const asks = [
    { search: "?debug", stored: null },
    { search: "?x=1&debug", stored: null },
    { search: "", stored: "1" },
    { search: "?debug", stored: "1" },
  ]

  it.each(asks)("ask for the tools outside production: %j", (ask) => {
    expect(debugAsked({ allowed: true, ...ask })).toBe(true)
  })

  it.each(asks)("ask for nothing in production: %j", (ask) => {
    expect(debugAsked({ allowed: false, ...ask })).toBe(false)
  })

  it("ask for nothing when neither is there", () => {
    expect(debugAsked({ allowed: true, search: "", stored: null })).toBe(false)
    expect(debugAsked({ allowed: true, search: "?x=1", stored: "0" })).toBe(false)
  })
})

describe("loading the tools", () => {
  it("a development build loads them on its own, outside production", () => {
    expect(debugLoadsAlone({ allowed: true, nodeEnv: "development", asked: false })).toBe(true)
  })

  it("a production build loads them once they are asked for, outside production (a preview)", () => {
    expect(debugLoadsAlone({ allowed: true, nodeEnv: "production", asked: false })).toBe(false)
    expect(debugLoadsAlone({ allowed: true, nodeEnv: "production", asked: true })).toBe(true)
  })

  it("nothing loads them on the production deployment, asked for or not", () => {
    for (const nodeEnv of ["development", "production", undefined]) {
      for (const asked of [false, true]) expect(debugLoadsAlone({ allowed: false, nodeEnv, asked })).toBe(false)
    }
  })
})

describe("the Shift+D shortcut", () => {
  const press = { shiftKey: true, key: "D", inField: false }

  it("toggles outside production, with either case of the letter", () => {
    expect(debugKeyToggles({ allowed: true, ...press })).toBe(true)
    expect(debugKeyToggles({ allowed: true, ...press, key: "d" })).toBe(true)
  })

  it("does nothing in production", () => {
    expect(debugKeyToggles({ allowed: false, ...press })).toBe(false)
  })

  it("does nothing without Shift, on another key, or while the visitor types", () => {
    expect(debugKeyToggles({ allowed: true, ...press, shiftKey: false })).toBe(false)
    expect(debugKeyToggles({ allowed: true, ...press, key: "E" })).toBe(false)
    expect(debugKeyToggles({ allowed: true, ...press, inField: true })).toBe(false)
  })
})
