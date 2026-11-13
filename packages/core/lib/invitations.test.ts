import { describe, expect, it } from "vitest"
import { INVITATION_TTL_MINUTES, MAX_INVITATIONS_RECEIVED, MAX_INVITATIONS_SENT, invitationActionPath, invitationOf, isInvitationId, livingInvitations } from "./invitations"

const ID = "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e"
const GOOD = { id: ID, from: { nickname: "Bob", tag: 42, avatarUrl: null }, game: { slug: "hanabi", name: "Hanabi" }, at: "2026-11-13T10:00:00.000Z", expiresAt: "2026-11-13T10:30:00.000Z" }

describe("the invitations' constants", () => {
  it("wait half an hour, and are capped", () => {
    expect(INVITATION_TTL_MINUTES).toBe(30)
    expect(MAX_INVITATIONS_SENT).toBeGreaterThan(0)
    expect(MAX_INVITATIONS_RECEIVED).toBeGreaterThan(0)
    expect(invitationActionPath("accept")).toBe("/api/hub/invitations/accept")
  })
})

describe("isInvitationId", () => {
  it("is a UUID and nothing else", () => {
    expect(isInvitationId(ID)).toBe(true)
    expect(isInvitationId(ID.toUpperCase())).toBe(true)
    for (const value of ["", "1", `${ID}x`, ` ${ID}`, 7, null, undefined, { id: ID }]) expect(isInvitationId(value)).toBe(false)
  })
})

describe("invitationOf", () => {
  it("reads what the server says", () => {
    expect(invitationOf(GOOD)).toEqual(GOOD)
  })

  it("is none for what is not one: the id, the person, the game or a date is not what it should be", () => {
    for (const bad of [null, "x", {}, { ...GOOD, id: "7" }, { ...GOOD, from: { nickname: "", tag: 1 } }, { ...GOOD, game: null }, { ...GOOD, game: { slug: "", name: "x" } }, { ...GOOD, game: { slug: "hanabi" } }, { ...GOOD, at: "soon" }, { ...GOOD, expiresAt: 5 }]) {
      expect(invitationOf(bad)).toBeNull()
    }
  })

  it("never carries a table's code, whatever the answer holds", () => {
    expect(JSON.stringify(invitationOf({ ...GOOD, code: "K7Q2", table: { code: "K7Q2" } }))).not.toContain("K7Q2")
  })
})

describe("livingInvitations", () => {
  it("keeps the ones that have not expired, with a minute of grace for a clock that is behind", () => {
    const now = Date.parse("2026-11-13T10:30:30.000Z")
    expect(livingInvitations([GOOD], now)).toEqual([GOOD])
    expect(livingInvitations([GOOD], Date.parse("2026-11-13T10:31:01.000Z"))).toEqual([])
  })
})
