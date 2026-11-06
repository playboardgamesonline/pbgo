import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => {
  type Options = { httpOnly?: boolean; sameSite?: string; secure?: boolean; path?: string; maxAge?: number }
  return {
    jar: new Map<string, string>(),
    writes: [] as Array<{ name: string; value: string; options: Options }>,
  }
})

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name)! } : undefined),
    set: (name: string, value: string, options: (typeof h.writes)[number]["options"]) => {
      h.jar.set(name, value)
      h.writes.push({ name, value, options })
    },
  }),
}))

import { getOrCreatePlayerId, getPlayerId } from "./player"
import { isPlayerSecret, newPlayerSecret, playerIdOf } from "./player-id"

const SLUG = "courtisans"
const COOKIE = "courtisans_player"
const LEGACY_COOKIE = "c58d1aa1-1a8f-4eac-921a-95604115b9db"

beforeEach(() => {
  h.jar.clear()
  h.writes.length = 0
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("getPlayerId", () => {
  it("is null for a browser with no cookie", async () => {
    expect(await getPlayerId(SLUG)).toBeNull()
  })

  it("is the player id of the secret in the cookie, never the secret", async () => {
    const secret = newPlayerSecret()
    h.jar.set(COOKIE, secret)
    const id = await getPlayerId(SLUG)
    expect(id).toBe(playerIdOf(SLUG, secret))
    expect(id).not.toBe(secret)
  })

  it("is null for a cookie that is not a secret of this server: a player id, or the UUID that the cookie held before", async () => {
    h.jar.set(COOKIE, LEGACY_COOKIE)
    expect(await getPlayerId(SLUG)).toBeNull()
    h.jar.set(COOKIE, playerIdOf(SLUG, newPlayerSecret()))
    expect(await getPlayerId(SLUG)).toBeNull()
    h.jar.set(COOKIE, "")
    expect(await getPlayerId(SLUG)).toBeNull()
  })

  it("reads the cookie of the game asked, and no other", async () => {
    h.jar.set("hanabi_player", newPlayerSecret())
    expect(await getPlayerId(SLUG)).toBeNull()
    expect(await getPlayerId("hanabi")).not.toBeNull()
  })

  it("names the cookie of a slug with a dash with an underscore", async () => {
    const secret = newPlayerSecret()
    h.jar.set("skull_king_player", secret)
    expect(await getPlayerId("skull-king")).toBe(playerIdOf("skull-king", secret))
  })

  it("has the same id for the same cookie, and each game its own", async () => {
    const secret = newPlayerSecret()
    h.jar.set(COOKIE, secret)
    h.jar.set("hanabi_player", secret)
    expect(await getPlayerId(SLUG)).toBe(await getPlayerId(SLUG))
    expect(await getPlayerId(SLUG)).not.toBe(await getPlayerId("hanabi"))
  })
})

describe("getOrCreatePlayerId", () => {
  it("gives a browser with no cookie a secret and answers its player id, not the secret", async () => {
    const id = await getOrCreatePlayerId(SLUG)
    expect(h.writes).toHaveLength(1)
    const [{ name, value, options }] = h.writes
    expect(name).toBe(COOKIE)
    expect(isPlayerSecret(value)).toBe(true)
    expect(id).toBe(playerIdOf(SLUG, value))
    expect(id).not.toBe(value)
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: false })
  })

  it("marks the cookie secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    await getOrCreatePlayerId(SLUG)
    expect(h.writes[0]?.options.secure).toBe(true)
  })

  it("keeps the secret a browser has: the same id, and no new cookie", async () => {
    const secret = newPlayerSecret()
    h.jar.set(COOKIE, secret)
    expect(await getOrCreatePlayerId(SLUG)).toBe(playerIdOf(SLUG, secret))
    expect(h.writes).toEqual([])
  })

  it("gives a new secret to a browser whose cookie is the old UUID, which every table it seated shows", async () => {
    h.jar.set(COOKIE, LEGACY_COOKIE)
    const id = await getOrCreatePlayerId(SLUG)
    expect(h.writes).toHaveLength(1)
    expect(h.jar.get(COOKIE)).not.toBe(LEGACY_COOKIE)
    expect(isPlayerSecret(h.jar.get(COOKIE)!)).toBe(true)
    expect(id).not.toBe(LEGACY_COOKIE)
    expect(id).toBe(await getPlayerId(SLUG))
  })

  it("answers the id that getPlayerId then finds", async () => {
    const id = await getOrCreatePlayerId(SLUG)
    expect(await getPlayerId(SLUG)).toBe(id)
  })
})
