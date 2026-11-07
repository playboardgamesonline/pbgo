import { describe, expect, it } from "vitest"
import { hasSessionCookie } from "./proxy"

describe("hasSessionCookie", () => {
  it("sees the session of a project, whole or cut in pieces", () => {
    expect(hasSessionCookie(["sb-igxsfcezbhidnlknuudf-auth-token"])).toBe(true)
    expect(hasSessionCookie(["theme", "sb-ckpbuuxcdsayonyahlkk-auth-token.0", "sb-ckpbuuxcdsayonyahlkk-auth-token.1"])).toBe(true)
  })

  it("does not take the secret of a sign-in that started for a session", () => {
    expect(hasSessionCookie(["sb-igxsfcezbhidnlknuudf-auth-token-code-verifier"])).toBe(false)
  })

  it("finds nothing in the cookies of a visitor who is not signed in", () => {
    expect(hasSessionCookie([])).toBe(false)
    expect(hasSessionCookie(["pbgo-locale", "pbgo_consent", "courtisans_player", "pbgo_demo_account"])).toBe(false)
    expect(hasSessionCookie(new Set(["sb-auth-token", "sb--auth-token.x", "xsb-ref-auth-token"]))).toBe(false)
  })
})
