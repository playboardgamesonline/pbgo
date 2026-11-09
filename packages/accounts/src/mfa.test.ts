import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { accountOf } from "./account"
import { MFA_MESSAGES, TOTP_LENGTH, aalOf, formatSetupKey, isTotpCode, mfaMessage, mfaProblem, qrImageOf, secondStepDevicesOf, secondStepPending, secondStepPendingOf, sinceLabel } from "./mfa"

/** An access token the way Supabase Auth shapes one: three base64url parts, the middle one the claims. Its signature is nothing: `aalOf` does not read it. */
function token(claims: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(claims))
  const payload = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return `eyJhbGciOiJFUzI1NiJ9.${payload}.c2ln`
}

const totp = { id: "f-1", factor_type: "totp", status: "verified", friendly_name: "Authenticator app", created_at: "2026-11-09T16:00:00.000Z" }

describe("the digits of a code", () => {
  it("are six, as an app shows them", () => {
    expect(TOTP_LENGTH).toBe(6)
  })

  it("are all a code is made of: anything else is not one, and is not sent to the Auth server", () => {
    expect(isTotpCode("123456")).toBe(true)
    expect(isTotpCode("000000")).toBe(true)
    for (const code of ["", "12345", "1234567", "12345a", "123 456", " 123456", "123456\n", "１２３４５６"]) expect(isTotpCode(code)).toBe(false)
  })
})

describe("aalOf", () => {
  it("reads the assurance level that a token says its session has", () => {
    expect(aalOf(token({ sub: "u-1", aal: "aal2" }))).toBe("aal2")
    expect(aalOf(token({ sub: "u-1", aal: "aal1" }))).toBe("aal1")
  })

  it("takes a token with no level for aal1, as Supabase's guide says, and so a level it does not know", () => {
    expect(aalOf(token({ sub: "u-1" }))).toBe("aal1")
    expect(aalOf(token({ sub: "u-1", aal: "aal3" }))).toBe("aal1")
    expect(aalOf(token({ sub: "u-1", aal: 2 }))).toBe("aal1")
  })

  it("reads the claims whatever else they hold: text that is not ASCII, and the characters of base64url", () => {
    expect(aalOf(token({ user_metadata: { full_name: "Oré Louvel ✓", note: "???>>>" }, aal: "aal2" }))).toBe("aal2")
  })

  it("reads nothing from what is not a token of Supabase Auth, and so never says aal2", () => {
    expect(aalOf(undefined)).toBeNull()
    expect(aalOf(null)).toBeNull()
    expect(aalOf("")).toBeNull()
    expect(aalOf("not-a-jwt")).toBeNull()
    expect(aalOf("a.b")).toBeNull()
    expect(aalOf("a.b.c.d")).toBeNull()
    expect(aalOf("a.!!!.c")).toBeNull()
    expect(aalOf(`a.${btoa("not json")}.c`)).toBeNull()
    expect(aalOf(`a.${btoa("[1, 2]")}.c`)).toBe("aal1")
    expect(aalOf(`a.${btoa("null")}.c`)).toBeNull()
    expect(aalOf(42 as unknown as string)).toBeNull()
  })
})

describe("secondStepDevicesOf", () => {
  it("keeps the verified TOTP factors: the authenticator apps that a member has set up", () => {
    expect(secondStepDevicesOf([totp])).toEqual([{ id: "f-1", name: "Authenticator app", createdAt: "2026-11-09T16:00:00.000Z" }])
  })

  it("leaves out a factor that was started and never proved: an abandoned set-up is no second step", () => {
    expect(secondStepDevicesOf([{ ...totp, status: "unverified" }])).toEqual([])
  })

  it("leaves out the factors of any other kind: none is offered, and none could be asked for at sign-in", () => {
    for (const factor_type of ["phone", "webauthn", "recovery_code", "", undefined]) {
      expect(secondStepDevicesOf([{ ...totp, factor_type }])).toEqual([])
    }
  })

  it("reads a factor with no id or no name safely", () => {
    expect(secondStepDevicesOf([{ ...totp, id: "" }, { ...totp, id: undefined }])).toEqual([])
    expect(secondStepDevicesOf([{ ...totp, friendly_name: "  ", created_at: null }])).toEqual([{ id: "f-1", name: null, createdAt: null }])
  })

  it("has none for a user the Auth server lists no factors for", () => {
    expect(secondStepDevicesOf(undefined)).toEqual([])
    expect(secondStepDevicesOf(null)).toEqual([])
    expect(secondStepDevicesOf([])).toEqual([])
  })

  it("is what an account holds as its second step", () => {
    expect(accountOf({ id: "u-1", factors: [totp, { ...totp, id: "f-2", status: "unverified" }] }).secondStep).toEqual([{ id: "f-1", name: "Authenticator app", createdAt: "2026-11-09T16:00:00.000Z" }])
    expect(accountOf({ id: "u-1" }).secondStep).toEqual([])
  })
})

describe("secondStepPending", () => {
  const device = { id: "f-1", name: null, createdAt: null }

  it("is true for a session that has not proved the second step of a member who has one", () => {
    expect(secondStepPending([device], "aal1")).toBe(true)
  })

  it("is false once the session has proved it", () => {
    expect(secondStepPending([device], "aal2")).toBe(false)
  })

  it("is false for a member who has none, whatever the level: nothing is asked of them", () => {
    expect(secondStepPending([], "aal1")).toBe(false)
    expect(secondStepPending([], "aal2")).toBe(false)
    expect(secondStepPending([], null)).toBe(false)
  })

  it("counts a level that could not be read as not proved, never as passed", () => {
    expect(secondStepPending([device], null)).toBe(true)
  })
})

describe("secondStepPendingOf", () => {
  const user = { factors: [totp] }

  it("decides from the user and the token a session holds", () => {
    expect(secondStepPendingOf(user, token({ aal: "aal1" }))).toBe(true)
    expect(secondStepPendingOf(user, token({ aal: "aal2" }))).toBe(false)
    expect(secondStepPendingOf(user, "garbage")).toBe(true)
    expect(secondStepPendingOf(user, undefined)).toBe(true)
  })

  it("asks nothing of a user with no verified factor, or of nobody", () => {
    expect(secondStepPendingOf({ factors: [{ ...totp, status: "unverified" }] }, token({ aal: "aal1" }))).toBe(false)
    expect(secondStepPendingOf({}, token({ aal: "aal1" }))).toBe(false)
    expect(secondStepPendingOf(null, token({ aal: "aal1" }))).toBe(false)
    expect(secondStepPendingOf(undefined, undefined)).toBe(false)
  })
})

describe("mfaProblem and mfaMessage", () => {
  const api = (code: string, status = 422) => new AuthApiError("Supabase's own words, never shown", status, code)

  it("tells a wrong code from an expired challenge, since what to do next differs", () => {
    expect(mfaProblem(api("mfa_verification_failed"))).toBe("wrong-code")
    expect(mfaProblem(api("mfa_challenge_expired"))).toBe("challenge-expired")
    expect(mfaMessage(api("mfa_verification_failed"))).toBe("That code is wrong or has expired. Check your app for the one it shows now.")
  })

  it("tells the connection that changed between the two halves of the check", () => {
    expect(mfaProblem(api("mfa_ip_address_mismatch"))).toBe("connection-changed")
  })

  it("tells a project that has app authenticators switched off, in either direction", () => {
    expect(mfaProblem(api("mfa_totp_enroll_not_enabled"))).toBe("unavailable")
    expect(mfaProblem(api("mfa_totp_verify_not_enabled"))).toBe("unavailable")
    expect(mfaMessage(api("mfa_totp_enroll_not_enabled"))).toBe("Multi-factor authentication is not available right now.")
  })

  it("tells too many apps, and a session that has not passed the second step", () => {
    expect(mfaProblem(api("too_many_enrolled_mfa_factors"))).toBe("too-many-devices")
    expect(mfaProblem(api("insufficient_aal", 401))).toBe("reauthenticate")
  })

  it("tells the limits: the one of Supabase Auth, and the one a hook of the project sets", () => {
    expect(mfaProblem(api("over_request_rate_limit", 429))).toBe("rate-limit")
    expect(mfaProblem(api("mfa_verification_rejected"))).toBe("rate-limit")
  })

  it("tells the network, a server that failed, and anything else", () => {
    expect(mfaProblem(new AuthRetryableFetchError("Failed to fetch", 0))).toBe("network")
    expect(mfaProblem(api("unexpected_failure", 500))).toBe("server")
    expect(mfaProblem(api("something_new"))).toBe("other")
    expect(mfaProblem(new Error("boom"))).toBe("other")
    expect(mfaProblem("boom")).toBe("other")
    expect(mfaProblem(null)).toBe("other")
  })

  it("has a sentence for every way, and none of them is Supabase's", () => {
    for (const message of Object.values(MFA_MESSAGES)) expect(message).toMatch(/^[A-Z].*\.$/)
    expect(mfaMessage(api("mfa_verification_failed"))).not.toContain("Supabase")
  })
})

describe("formatSetupKey", () => {
  it("shows the key in groups of four, which is what a person types", () => {
    expect(formatSetupKey("ABCDEFGHIJKLMNOP")).toBe("ABCD EFGH IJKL MNOP")
    expect(formatSetupKey("ABCDEFGHIJ")).toBe("ABCD EFGH IJ")
  })

  it("takes the spaces out first, so that a key that is formatted already stays so", () => {
    expect(formatSetupKey("ABCD EFGH\nIJKL")).toBe("ABCD EFGH IJKL")
    expect(formatSetupKey("")).toBe("")
  })
})

describe("qrImageOf", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect style="fill:#000000" width="1" height="1"/></svg>'

  it("encodes the markup that the client library puts after the comma as it is, so that its # cannot cut the address short", () => {
    const image = qrImageOf(`data:image/svg+xml;utf-8,${svg}`)
    expect(image).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    expect(image).not.toContain("#")
    expect(decodeURIComponent(image!.split(",")[1])).toBe(svg)
  })

  it("leaves an address that is encoded already alone", () => {
    const encoded = `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`
    expect(qrImageOf(encoded)).toBe(encoded)
  })

  it("takes nothing that is not an SVG data URI: no picture, and the key is there to type", () => {
    expect(qrImageOf(svg)).toBeNull()
    expect(qrImageOf("https://example.com/qr.svg")).toBeNull()
    expect(qrImageOf("data:image/png;base64,AAAA")).toBeNull()
    expect(qrImageOf("data:text/html,<script>alert(1)</script>")).toBeNull()
    expect(qrImageOf("javascript:alert(1)")).toBeNull()
    expect(qrImageOf(undefined)).toBeNull()
    expect(qrImageOf(42)).toBeNull()
  })
})

describe("sinceLabel", () => {
  it("says the day on the UTC calendar, in words", () => {
    expect(sinceLabel("2026-11-09T16:00:00.000Z")).toBe("9 November 2026")
    expect(sinceLabel("2026-11-09T23:59:59.000Z")).toBe("9 November 2026")
    expect(sinceLabel("2026-12-01T00:00:00.000Z")).toBe("1 December 2026")
  })

  it("says nothing of a date that is not known", () => {
    expect(sinceLabel(null)).toBeNull()
    expect(sinceLabel(undefined)).toBeNull()
    expect(sinceLabel("")).toBeNull()
    expect(sinceLabel("yesterday")).toBeNull()
  })
})
