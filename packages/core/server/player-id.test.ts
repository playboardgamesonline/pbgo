import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { isPlayerSecret, newPlayerSecret, playerIdOf } from "./player-id"

const SECRET = "A".repeat(43)
const LEGACY_COOKIE = "c58d1aa1-1a8f-4eac-921a-95604115b9db"

describe("newPlayerSecret", () => {
  it("is 43 characters of base64url: 256 random bits", () => {
    expect(newPlayerSecret()).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it("is never the same twice", () => {
    expect(new Set(Array.from({ length: 200 }, newPlayerSecret)).size).toBe(200)
  })
})

describe("isPlayerSecret", () => {
  it("accepts what newPlayerSecret makes", () => {
    for (let i = 0; i < 50; i++) expect(isPlayerSecret(newPlayerSecret())).toBe(true)
  })

  it.each([
    ["nothing", ""],
    ["a UUID, the value of the cookie before the id and the secret were told apart", LEGACY_COOKIE],
    ["a player id", playerIdOf("courtisans", SECRET)],
    ["a secret one character short", "A".repeat(42)],
    ["a secret one character long", "A".repeat(44)],
    ["a secret with a character outside base64url", `${"A".repeat(42)}+`],
    ["a secret with a space", `${"A".repeat(42)} `],
    ["a secret with a line break", `${"A".repeat(42)}\n`],
  ])("refuses %s", (_name, value) => {
    expect(isPlayerSecret(value)).toBe(false)
  })
})

describe("playerIdOf", () => {
  it("is 32 characters of lowercase hexadecimal, with no ':' for the takeover votes to trip on", () => {
    expect(playerIdOf("courtisans", newPlayerSecret())).toMatch(/^[0-9a-f]{32}$/)
  })

  it("is the same for the same secret in the same game, wherever and whenever it is asked", () => {
    expect(playerIdOf("courtisans", SECRET)).toBe(playerIdOf("courtisans", SECRET))
  })

  it("tells two secrets apart, and one secret in two games", () => {
    expect(playerIdOf("courtisans", SECRET)).not.toBe(playerIdOf("courtisans", "B".repeat(43)))
    expect(playerIdOf("courtisans", SECRET)).not.toBe(playerIdOf("skull-king", SECRET))
  })

  it("keeps its value: changing the derivation would give every player a new id and strand every table in play", () => {
    expect(playerIdOf("courtisans", SECRET)).toBe("6011d68dd97b2f4679e8a9a2fcd889ca")
    expect(playerIdOf("skull-king", SECRET)).toBe("e7fae0ad66ae0854380b7c75e3e356cf")
    expect(playerIdOf("courtisans", "B".repeat(43))).toBe("5f7e72f3a215f9bb81e2ccc73b9d239a")
  })

  it("is not a secret, and the id of an id is somebody else: giving the id back as the cookie gets nowhere", () => {
    const id = playerIdOf("courtisans", SECRET)
    expect(isPlayerSecret(id)).toBe(false)
    expect(playerIdOf("courtisans", id)).not.toBe(id)
  })

  it("holds nothing of the secret", () => {
    const secret = newPlayerSecret()
    const id = playerIdOf("courtisans", secret)
    for (let start = 0; start + 6 <= secret.length; start++) expect(id).not.toContain(secret.slice(start, start + 6))
  })
})
