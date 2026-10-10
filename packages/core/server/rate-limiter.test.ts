import { describe, expect, it } from "vitest"
import { MemoryRateLimitStore, RATE_LIMITS, checkRateLimit, clientIp, rateLimitKeys } from "./rate-limiter"

const rule = { limit: 3, windowMs: 1_000 }

describe("MemoryRateLimitStore", () => {
  it("allows up to the limit in the window, then refuses with the time to wait", async () => {
    const store = new MemoryRateLimitStore()
    expect((await store.hit("k", rule, 0)).remaining).toBe(2)
    await store.hit("k", rule, 100)
    expect((await store.hit("k", rule, 200)).ok).toBe(true)
    const refused = await store.hit("k", rule, 300)
    expect(refused).toEqual({ ok: false, remaining: 0, retryAfterMs: 700 })
  })

  it("slides the window and does not record refused requests", async () => {
    const store = new MemoryRateLimitStore()
    for (const t of [0, 100, 200]) await store.hit("k", rule, t)
    for (let t = 300; t < 1_000; t += 50) expect((await store.hit("k", rule, t)).ok).toBe(false)
    expect((await store.hit("k", rule, 1_000)).ok).toBe(true) // the hit at 0 left the window
    expect((await store.hit("k", rule, 1_050)).ok).toBe(false)
    expect((await store.hit("k", rule, 1_100)).ok).toBe(true)
  })

  it("counts keys separately", async () => {
    const store = new MemoryRateLimitStore()
    for (let i = 0; i < 3; i++) await store.hit("a", rule, 0)
    expect((await store.hit("a", rule, 0)).ok).toBe(false)
    expect((await store.hit("b", rule, 0)).ok).toBe(true)
  })

  it("sweeps expired keys and caps the number of keys", async () => {
    const store = new MemoryRateLimitStore(2)
    await store.hit("a", rule, 0)
    await store.hit("b", rule, 0)
    await store.hit("c", rule, 0)
    expect(store.size).toBe(2)
    expect((await store.hit("b", rule, 0)).remaining).toBe(1) // "a", the least recently used, was dropped
    store.sweep(5_000)
    expect(store.size).toBe(0)
  })
})

describe("clientIp", () => {
  it("reads the first forwarded address, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4")
    expect(clientIp(new Headers({ "x-vercel-forwarded-for": "5.6.7.8", "x-forwarded-for": "1.2.3.4" }))).toBe("5.6.7.8")
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9")
    expect(clientIp(new Headers())).toBeNull()
  })
})

describe("rateLimitKeys", () => {
  it("keys per player when the cookie is there, else per IP, always with the IP ceiling", () => {
    expect(rateLimitKeys("action", { playerId: "p1", ip: "1.1.1.1" }).map(([k]) => k)).toEqual(["ip:1.1.1.1", "action:player:p1"])
    expect(rateLimitKeys("action", { ip: "1.1.1.1" }).map(([k]) => k)).toEqual(["ip:1.1.1.1", "action:ip:1.1.1.1"])
    expect(rateLimitKeys("action", { playerId: "p1" }).map(([k]) => k)).toEqual(["action:player:p1"])
    expect(rateLimitKeys("action", {})).toEqual([])
  })

  it("keys table creation per IP even with a player cookie", () => {
    expect(rateLimitKeys("create", { playerId: "p1", ip: "1.1.1.1" }).map(([k]) => k)).toEqual(["ip:1.1.1.1", "create:ip:1.1.1.1"])
  })
})

describe("checkRateLimit", () => {
  it("lets a whole table send readMissions with client retries at once, even behind one IP", async () => {
    const store = new MemoryRateLimitStore()
    // Courtisans opening: 5 players confirm together, each with up to 3 client retries (4 calls)
    for (let attempt = 0; attempt < 4; attempt++) {
      for (const player of ["a", "b", "c", "d", "e"]) {
        const result = await checkRateLimit(store, rateLimitKeys("action", { playerId: player, ip: "1.1.1.1" }), attempt * 300)
        expect(result.ok).toBe(true)
      }
    }
  })

  it("stops one player spamming actions without blocking the others", async () => {
    const store = new MemoryRateLimitStore()
    const send = (playerId: string) => checkRateLimit(store, rateLimitKeys("action", { playerId, ip: "1.1.1.1" }), 0)
    for (let i = 0; i < RATE_LIMITS.action.limit; i++) expect((await send("spammer")).ok).toBe(true)
    expect((await send("spammer")).ok).toBe(false)
    expect((await send("friend")).ok).toBe(true)
  })

  it("caps an IP rotating player cookies", async () => {
    const store = new MemoryRateLimitStore()
    let refused = 0
    for (let i = 0; i < RATE_LIMITS.ip.limit + 10; i++) {
      if (!(await checkRateLimit(store, rateLimitKeys("action", { playerId: `fake-${i}`, ip: "6.6.6.6" }), 0)).ok) refused++
    }
    expect(refused).toBe(10)
  })
})
