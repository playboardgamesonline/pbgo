import { describe, expect, it } from "vitest"
import { DELETION_MESSAGES, REOPEN_PATH, deletionDate, deletionMessage, hasMailbox, isReopenToken, isUserId, maskEmail, reopenLink, reopenLinkOf } from "./deletion"

const USER = "3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b"
const TOKEN = "A".repeat(43)

describe("an address that mail can reach", () => {
  it("is a real address", () => {
    for (const email of ["ore@example.com", "marly_74@mail.example.co.uk", "a+b@example.org", "  ore@example.com  "]) expect(hasMailbox(email), email).toBe(true)
  })

  it("is not the stand-in of a provider that gives none (the domain .invalid never receives mail), nor nothing, nor a word", () => {
    for (const email of ["steam-3f2b8c1e@external.pbgo.invalid", "someone@invalid", "someone@Mail.INVALID", null, undefined, "", "   ", "ore", "ore@", "@example.com", "ore@example", "or e@example.com"]) {
      expect(hasMailbox(email), String(email)).toBe(false)
    }
  })

  it("is told with its first letter and its domain", () => {
    expect(maskEmail("ore@example.com")).toBe("o•••@example.com")
    expect(maskEmail("Éloïse.Martin@mail.example.co.uk")).toBe("É•••@mail.example.co.uk")
    expect(maskEmail("a@b.co")).toBe("a•••@b.co")
    expect(maskEmail("nonsense")).toBe("•••")
  })
})

describe("the link of the e-mail", () => {
  it("carries the account and the token, to the page that reopens the account", () => {
    expect(REOPEN_PATH).toBe("/auth/reopen-account")
    expect(reopenLink("https://playboardgamesonline.app", USER, TOKEN)).toBe(`https://playboardgamesonline.app/auth/reopen-account?u=${USER}&t=${TOKEN}`)
    expect(reopenLink("http://localhost:3140///", USER, TOKEN)).toBe(`http://localhost:3140/auth/reopen-account?u=${USER}&t=${TOKEN}`)
  })

  it("is read back from the query of the page, and from nothing else", () => {
    expect(reopenLinkOf({ u: USER, t: TOKEN })).toEqual({ user: USER, token: TOKEN })
    expect(reopenLinkOf({ u: [USER, "x"], t: [TOKEN] })).toEqual({ user: USER, token: TOKEN })
    expect(reopenLinkOf({})).toBeNull()
    expect(reopenLinkOf({ u: USER })).toBeNull()
    expect(reopenLinkOf({ t: TOKEN })).toBeNull()
    expect(reopenLinkOf({ u: "demo", t: TOKEN })).toBeNull()
    expect(reopenLinkOf({ u: USER, t: "short" })).toBeNull()
    expect(reopenLinkOf({ u: USER, t: `${TOKEN}A` })).toBeNull()
  })

  it("knows an account id and a token by their shape", () => {
    expect(isUserId(USER)).toBe(true)
    expect(isUserId(USER.toUpperCase())).toBe(true)
    for (const bad of ["", "demo", USER.slice(1), `${USER}0`, `${USER.slice(0, 35)}g`, 42, null, undefined]) expect(isUserId(bad), String(bad)).toBe(false)
    expect(isReopenToken(TOKEN)).toBe(true)
    expect(isReopenToken("a-_".repeat(14) + "a")).toBe(true)
    for (const bad of ["", TOKEN.slice(1), `${TOKEN}A`, `${TOKEN.slice(1)}+`, `${TOKEN.slice(1)}=`, `${TOKEN.slice(1)} `, 42, null]) expect(isReopenToken(bad), String(bad)).toBe(false)
  })
})

describe("what a member is told", () => {
  it("is a sentence of ours for every code the route refuses with, and a plain one for any other", () => {
    for (const code of ["NOT_SIGNED_IN", "NO_MAILBOX", "MAIL_UNAVAILABLE", "MAIL_FAILED", "LINK_INVALID", "RATE_LIMITED", "INVALID_REQUEST", "CROSS_ORIGIN"]) {
      expect(DELETION_MESSAGES[code], code).toBeTruthy()
      expect(deletionMessage(code)).toBe(DELETION_MESSAGES[code])
    }
    expect(deletionMessage("SERVER_ERROR")).toBe("Something went wrong. Try again.")
    expect(deletionMessage(undefined)).toBe("Something went wrong. Try again.")
  })

  it("says that a failed e-mail left the account open, since the account is closed only once the e-mail is gone", () => {
    expect(DELETION_MESSAGES.MAIL_FAILED).toContain("still open")
  })

  it("says a day as a person reads it, on the UTC day the clean-up goes by", () => {
    expect(deletionDate("2026-11-16T23:59:59.999Z")).toBe("16 November 2026")
    expect(deletionDate("2026-12-31T23:59:59.000Z")).toBe("31 December 2026")
    expect(deletionDate("2027-01-01T00:00:00.000Z")).toBe("1 January 2027")
  })
})
