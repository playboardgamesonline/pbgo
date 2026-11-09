import { describe, expect, it } from "vitest"
import { accountOf } from "./account"
import { DEMO_ACCOUNT, DEMO_HELD, heldDemoAccount } from "./demo"
import {
  DELETION_KEY,
  DELETION_MESSAGES,
  DELETION_PATH,
  deletionAtOf,
  deletionDate,
  deletionLink,
  deletionLinkOf,
  deletionMessage,
  hasMailbox,
  isDeletionToken,
  isOnHold,
  isUserId,
  maskEmail,
} from "./deletion"

const USER = "3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b"
const TOKEN = "A".repeat(43)

describe("the mark of an account on hold", () => {
  it("is the day the account is deleted, in the app metadata that only the server writes", () => {
    expect(DELETION_KEY).toBe("pbgo_deletion_at")
    expect(deletionAtOf({ app_metadata: { provider: "email", [DELETION_KEY]: "2026-12-09T03:17:00Z" } })).toBe("2026-12-09T03:17:00.000Z")
    expect(deletionAtOf({ app_metadata: { [DELETION_KEY]: "2026-12-09T03:17:00.250+00:00" } })).toBe("2026-12-09T03:17:00.250Z")
  })

  it("is not there on an account that is not on hold, and a value that is not a date holds nothing", () => {
    expect(deletionAtOf({})).toBeNull()
    expect(deletionAtOf({ app_metadata: { provider: "email" } })).toBeNull()
    for (const junk of [null, 0, true, 1796787420, "", "tomorrow", "2026-12-09", "2026-13-45T99:99:99Z", { at: "2026-12-09T03:17:00Z" }]) {
      expect(deletionAtOf({ app_metadata: { [DELETION_KEY]: junk } }), String(junk)).toBeNull()
    }
  })

  it("makes an account of a user ON HOLD, with its day", () => {
    const held = accountOf({ id: USER, email: "ore@example.com", app_metadata: { provider: "email", [DELETION_KEY]: "2026-12-09T03:17:00Z" } })
    expect(held.deletionAt).toBe("2026-12-09T03:17:00.000Z")
    expect(accountOf({ id: USER, email: "ore@example.com" }).deletionAt).toBeNull()
  })

  it("is read from the app metadata of a user or of the claims of a token, and from nothing else", () => {
    expect(isOnHold({ provider: "email", [DELETION_KEY]: "2026-12-09T03:17:00Z" })).toBe(true)
    for (const metadata of [undefined, null, "nonsense", 42, [], {}, { provider: "email" }, { [DELETION_KEY]: "soon" }]) expect(isOnHold(metadata), String(metadata)).toBe(false)
  })

  it("has a demo account on hold for development, with a day ahead", () => {
    const now = new Date("2026-11-09T12:00:00Z")
    expect(DEMO_HELD).toBe("held")
    expect(DEMO_ACCOUNT.deletionAt).toBeNull()
    expect(heldDemoAccount(now)).toEqual({ ...DEMO_ACCOUNT, deletionAt: "2026-12-08T12:00:00.000Z" })
  })
})

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
  it("carries the account and the token, to the page that asks for the last confirmation", () => {
    expect(DELETION_PATH).toBe("/auth/delete-account")
    expect(deletionLink("https://playboardgamesonline.app", USER, TOKEN)).toBe(`https://playboardgamesonline.app/auth/delete-account?u=${USER}&t=${TOKEN}`)
    expect(deletionLink("http://localhost:3140///", USER, TOKEN)).toBe(`http://localhost:3140/auth/delete-account?u=${USER}&t=${TOKEN}`)
  })

  it("is read back from the query of the page, and from nothing else", () => {
    expect(deletionLinkOf({ u: USER, t: TOKEN })).toEqual({ user: USER, token: TOKEN })
    expect(deletionLinkOf({ u: [USER, "x"], t: [TOKEN] })).toEqual({ user: USER, token: TOKEN })
    expect(deletionLinkOf({})).toBeNull()
    expect(deletionLinkOf({ u: USER })).toBeNull()
    expect(deletionLinkOf({ t: TOKEN })).toBeNull()
    expect(deletionLinkOf({ u: "demo", t: TOKEN })).toBeNull()
    expect(deletionLinkOf({ u: USER, t: "short" })).toBeNull()
    expect(deletionLinkOf({ u: USER, t: `${TOKEN}A` })).toBeNull()
  })

  it("knows an account id and a token by their shape", () => {
    expect(isUserId(USER)).toBe(true)
    expect(isUserId(USER.toUpperCase())).toBe(true)
    for (const bad of ["", "demo", USER.slice(1), `${USER}0`, `${USER.slice(0, 35)}g`, 42, null, undefined]) expect(isUserId(bad), String(bad)).toBe(false)
    expect(isDeletionToken(TOKEN)).toBe(true)
    expect(isDeletionToken("a-_".repeat(14) + "a")).toBe(true)
    for (const bad of ["", TOKEN.slice(1), `${TOKEN}A`, `${TOKEN.slice(1)}+`, `${TOKEN.slice(1)}=`, `${TOKEN.slice(1)} `, 42, null]) expect(isDeletionToken(bad), String(bad)).toBe(false)
  })
})

describe("what a member is told", () => {
  it("is a sentence of ours for every code the route refuses with, and a plain one for any other", () => {
    for (const code of ["NOT_SIGNED_IN", "NO_MAILBOX", "MAIL_UNAVAILABLE", "MAIL_FAILED", "WAIT", "ON_HOLD", "NOT_ON_HOLD", "LINK_INVALID", "RATE_LIMITED", "INVALID_REQUEST", "CROSS_ORIGIN"]) {
      expect(DELETION_MESSAGES[code], code).toBeTruthy()
      expect(deletionMessage(code)).toBe(DELETION_MESSAGES[code])
    }
    expect(deletionMessage("SERVER_ERROR")).toBe("Something went wrong. Try again.")
    expect(deletionMessage(undefined)).toBe("Something went wrong. Try again.")
  })

  it("says a day as a person reads it, on the UTC day the clean-up goes by", () => {
    expect(deletionDate("2026-12-09T03:17:00.000Z")).toBe("9 December 2026")
    expect(deletionDate("2026-12-31T23:59:59.000Z")).toBe("31 December 2026")
    expect(deletionDate("2027-01-01T00:00:00.000Z")).toBe("1 January 2027")
  })
})
