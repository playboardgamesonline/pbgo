import { describe, expect, it } from "vitest"
import { AFTER_SIGN_IN, safeNext } from "./redirect"

describe("safeNext", () => {
  it("goes back to a path of this site, query and fragment kept", () => {
    expect(safeNext("/me/games")).toBe("/me/games")
    expect(safeNext("/games?category=Cards&players=5")).toBe("/games?category=Cards&players=5")
    expect(safeNext("/game/courtisans#rules")).toBe("/game/courtisans#rules")
    expect(safeNext("/")).toBe("/")
  })

  it("goes to the visitor's own page when nothing says where they came from", () => {
    expect(safeNext(null)).toBe(AFTER_SIGN_IN)
    expect(safeNext(undefined)).toBe(AFTER_SIGN_IN)
    expect(safeNext("")).toBe(AFTER_SIGN_IN)
    expect(AFTER_SIGN_IN).toBe("/me")
  })

  it.each(["https://evil.example/me", "http://evil.example", "//evil.example/me", "///evil.example", "/\\evil.example", "\\\\evil.example", "javascript:alert(1)", "me/games", "evil.example"])(
    "refuses what is not a path of this site (%j)",
    (value) => {
      expect(safeNext(value)).toBe(AFTER_SIGN_IN)
    },
  )

  it("refuses a control character, a way to split a header or hide a character", () => {
    expect(safeNext("/me\r\nSet-Cookie: x=1")).toBe(AFTER_SIGN_IN)
    expect(safeNext("/me\u0000")).toBe(AFTER_SIGN_IN)
    expect(safeNext("/me\u007f")).toBe(AFTER_SIGN_IN)
  })

  it.each(["/login", "/login?next=/me", "/login/", "/logout", "/auth/callback", "/auth/demo?next=/me", "/auth"])("does not go back to the sign-in's own way (%j)", (value) => {
    expect(safeNext(value)).toBe(AFTER_SIGN_IN)
  })

  it("only takes the own ways of the sign-in, not a page whose name starts like one", () => {
    expect(safeNext("/loginfo")).toBe("/loginfo")
    expect(safeNext("/authors")).toBe("/authors")
  })

  it("falls back to the one it is given", () => {
    expect(safeNext("https://evil.example", "/games")).toBe("/games")
    expect(safeNext(null, "/")).toBe("/")
  })
})
