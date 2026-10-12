import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  type AdminCredentials,
  MIN_SECRET_LENGTH,
  SESSION_TTL_SECONDS,
  adminAccess,
  checkCredentials,
  signSession,
  verifySession,
} from "./admin-session"

const SECRET = "s".repeat(MIN_SECRET_LENGTH)
const credentials: AdminCredentials = { login: "ore", password: "correct horse", secret: SECRET }
const NOW = Date.parse("2026-01-01T00:00:00Z")
const later = (seconds: number) => NOW + seconds * 1000

describe("adminAccess", () => {
  const env = { ADMIN_LOGIN: "ore", ADMIN_PASSWORD: "correct horse", ADMIN_SESSION_SECRET: SECRET }

  it("is configured when login, password and a long enough secret are set", () => {
    expect(adminAccess({ ...env, NODE_ENV: "production" })).toEqual({ mode: "configured", credentials })
  })

  it("refuses to open the gamemaster when nothing is configured, in production and on previews", () => {
    for (const NODE_ENV of ["production", "test", undefined]) {
      expect(adminAccess({ NODE_ENV })).toEqual({
        mode: "unconfigured",
        problems: ["ADMIN_LOGIN is not set", "ADMIN_PASSWORD is not set", "ADMIN_SESSION_SECRET is not set"],
      })
    }
  })

  it("is open only in local development with nothing configured", () => {
    expect(adminAccess({ NODE_ENV: "development" })).toEqual({ mode: "open" })
    expect(adminAccess({ NODE_ENV: "development", ADMIN_LOGIN: "", ADMIN_PASSWORD: "", ADMIN_SESSION_SECRET: "" })).toEqual({ mode: "open" })
  })

  it("does not open a half configured development environment, and says what is missing", () => {
    expect(adminAccess({ NODE_ENV: "development", ADMIN_LOGIN: "ore", ADMIN_PASSWORD: "correct horse" })).toEqual({
      mode: "unconfigured",
      problems: ["ADMIN_SESSION_SECRET is not set"],
    })
    expect(adminAccess({ NODE_ENV: "development", ADMIN_SESSION_SECRET: SECRET })).toEqual({
      mode: "unconfigured",
      problems: ["ADMIN_LOGIN is not set", "ADMIN_PASSWORD is not set"],
    })
  })

  it("rejects a secret that is too short", () => {
    const short = "x".repeat(MIN_SECRET_LENGTH - 1)
    expect(adminAccess({ ...env, ADMIN_SESSION_SECRET: short, NODE_ENV: "production" })).toEqual({
      mode: "unconfigured",
      problems: [`ADMIN_SESSION_SECRET is shorter than ${MIN_SECRET_LENGTH} characters`],
    })
  })

  it("treats a blank login as missing", () => {
    expect(adminAccess({ ...env, ADMIN_LOGIN: "   ", NODE_ENV: "production" })).toMatchObject({ mode: "unconfigured", problems: ["ADMIN_LOGIN is not set"] })
  })
})

describe("checkCredentials", () => {
  it("accepts the exact login and password", () => {
    expect(checkCredentials(credentials, "ore", "correct horse")).toBe(true)
  })

  it("rejects a wrong login, a wrong password, both, and empty values", () => {
    expect(checkCredentials(credentials, "other", "correct horse")).toBe(false)
    expect(checkCredentials(credentials, "ore", "wrong")).toBe(false)
    expect(checkCredentials(credentials, "other", "wrong")).toBe(false)
    expect(checkCredentials(credentials, "", "")).toBe(false)
  })

  it("compares the whole value, not a prefix, and is case sensitive", () => {
    expect(checkCredentials(credentials, "ore", "correct")).toBe(false)
    expect(checkCredentials(credentials, "ore", "correct horse and more")).toBe(false)
    expect(checkCredentials(credentials, "ORE", "correct horse")).toBe(false)
  })
})

describe("signSession / verifySession", () => {
  it("accepts a fresh token", () => {
    expect(verifySession(signSession(credentials, NOW), credentials, NOW)).toBe(true)
    expect(verifySession(signSession(credentials, NOW), credentials, later(60 * 60 * 24))).toBe(true)
  })

  it("has the shape v1.<expiry>.<signature> and expires after the TTL", () => {
    const [version, expiry, signature, ...rest] = signSession(credentials, NOW).split(".")
    expect(version).toBe("v1")
    expect(Number(expiry)).toBe(NOW / 1000 + SESSION_TTL_SECONDS)
    expect(signature).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(rest).toEqual([])
  })

  it("rejects an expired token", () => {
    const token = signSession(credentials, NOW)
    expect(verifySession(token, credentials, later(SESSION_TTL_SECONDS - 1))).toBe(true)
    expect(verifySession(token, credentials, later(SESSION_TTL_SECONDS))).toBe(false)
    expect(verifySession(token, credentials, later(SESSION_TTL_SECONDS + 3600))).toBe(false)
  })

  it("rejects a tampered expiry, even to a later date", () => {
    const [version, expiry, signature] = signSession(credentials, NOW).split(".")
    const forged = `${version}.${Number(expiry) + 1}.${signature}`
    expect(verifySession(forged, credentials, NOW)).toBe(false)
    expect(verifySession(forged, credentials, later(SESSION_TTL_SECONDS))).toBe(false)
  })

  it("rejects a tampered signature", () => {
    const [version, expiry, signature] = signSession(credentials, NOW).split(".")
    const flipped = `${signature!.slice(0, -1)}${signature!.endsWith("A") ? "B" : "A"}`
    expect(verifySession(`${version}.${expiry}.${flipped}`, credentials, NOW)).toBe(false)
    expect(verifySession(`${version}.${expiry}.`, credentials, NOW)).toBe(false)
    expect(verifySession(`${version}.${expiry}.${signature}.extra`, credentials, NOW)).toBe(false)
  })

  it("rejects malformed values", () => {
    for (const token of [undefined, "", ".", "..", "v1", "v1.123", "v1..sig", "v2.9999999999.sig", "abc.def.ghi", "v1.-5.sig", "v1.1e9.sig"]) {
      expect(verifySession(token, credentials, NOW)).toBe(false)
    }
  })

  it("rejects the legacy sha256 cookie value", () => {
    expect(verifySession("a".repeat(64), credentials, NOW)).toBe(false)
  })

  it("rejects an expiry further away than the TTL, even when correctly signed", () => {
    const expiry = NOW / 1000 + SESSION_TTL_SECONDS * 2
    const payload = `v1.${expiry}`
    const key = createHmac("sha256", SECRET).update(`${credentials.login}\0${credentials.password}`).digest()
    const forged = `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`
    expect(verifySession(forged, credentials, NOW)).toBe(false)
  })

  it("tolerates a small clock difference between two instances", () => {
    expect(verifySession(signSession(credentials, later(30)), credentials, NOW)).toBe(true)
    expect(verifySession(signSession(credentials, later(600)), credentials, NOW)).toBe(false)
  })

  it("is invalidated by a password change, a login change or a new secret", () => {
    const token = signSession(credentials, NOW)
    expect(verifySession(token, { ...credentials, password: "another password" }, NOW)).toBe(false)
    expect(verifySession(token, { ...credentials, login: "someone" }, NOW)).toBe(false)
    expect(verifySession(token, { ...credentials, secret: "t".repeat(MIN_SECRET_LENGTH) }, NOW)).toBe(false)
  })

  it("does not accept a token signed with the same secret but other credentials swapped around", () => {
    const swapped = { ...credentials, login: "correct horse", password: "ore" }
    expect(verifySession(signSession(swapped, NOW), credentials, NOW)).toBe(false)
  })
})
