/**
 * Rate limiting: pure logic (no Next, no cookies), shared by the API routes through `server/rate-limit.ts` and tested in `rate-limiter.test.ts`.
 *
 * Every rule lives in `RATE_LIMITS`. A request is counted against:
 * - its route rule, keyed per player (cookie id) when the route allows it, else per IP — never per table, so a whole table
 *   acting at once (Courtisans opening: every player sends `readMissions`, with client retries) never shares a budget;
 * - a per-IP ceiling across all game routes, so rotating the (unsigned) player cookie doesn't bypass the per-player rules.
 *
 * LIMITATION: `MemoryRateLimitStore` keeps its counters in the memory of one server instance. On Vercel every lambda instance
 * has its own counters (and loses them on cold start), so the effective limit is "per instance": it stops bursts from one client
 * hitting a warm instance, not a distributed attack. To share counters, implement `RateLimitStore` on a shared backend
 * (Upstash Redis, a Supabase table/RPC…) and install it with `setRateLimitStore()`; nothing else changes.
 */

export type RateLimitRule = {
  /** Allowed requests per window */
  limit: number
  windowMs: number
  /** Key the rule per player cookie when present (default), or always per IP (routes that create the player, e.g. create game) */
  by?: "player" | "ip"
}

/** All limits, in one place. Sized well above normal play: a human clicks far less than this, scripts don't. */
export const RATE_LIMITS = {
  /** Create a table: per IP, a player cookie is minted on the fly */
  create: { limit: 10, windowMs: 60_000, by: "ip" },
  join: { limit: 20, windowMs: 60_000 },
  leave: { limit: 20, windowMs: 60_000 },
  /** Host tweaking options in the lobby (each click is a request) */
  options: { limit: 30, windowMs: 10_000 },
  start: { limit: 10, windowMs: 60_000 },
  /** Game moves (including Courtisans `readMissions` and its retries): per player, never per table */
  action: { limit: 20, windowMs: 10_000 },
  replay: { limit: 10, windowMs: 60_000 },
  /** Votes to play for an absent player (core `takeover`, Courtisans `banquet`) */
  vote: { limit: 10, windowMs: 60_000 },
  /** Feedback form: fast in-memory gate in front of the durable checks done in the database (room to resend after a validation error) */
  feedback: { limit: 3, windowMs: 10_000 },
  /** Ceiling per IP across every limited route (several players behind one NAT stay well below it) */
  ip: { limit: 200, windowMs: 10_000, by: "ip" },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitName = Exclude<keyof typeof RATE_LIMITS, "ip">

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterMs: number }

/** Counter backend. Async so a shared store (Redis, database) can implement it as is. */
export interface RateLimitStore {
  hit(key: string, rule: RateLimitRule, now?: number): Promise<RateLimitResult>
}

/**
 * Sliding-window log in memory: each key keeps the timestamps of its accepted requests in the window (at most `limit` of them).
 * Rejected requests are not recorded, so a client hammering a route gets through again once its window has slid.
 * Expired keys are swept regularly and the number of keys is capped (oldest dropped first) to bound memory.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private hits = new Map<string, { stamps: number[]; windowMs: number }>()
  private calls = 0

  constructor(private maxKeys = 10_000) {}

  get size() {
    return this.hits.size
  }

  async hit(key: string, rule: RateLimitRule, now = Date.now()): Promise<RateLimitResult> {
    if (++this.calls % 500 === 0) this.sweep(now)
    const entry = this.hits.get(key)
    const stamps = (entry?.stamps ?? []).filter((t) => t > now - rule.windowMs)
    if (stamps.length >= rule.limit) {
      this.hits.set(key, { stamps, windowMs: rule.windowMs })
      return { ok: false, remaining: 0, retryAfterMs: stamps[0]! + rule.windowMs - now }
    }
    stamps.push(now)
    // re-insert so Map order stays "least recently used first" for the cap below
    this.hits.delete(key)
    this.hits.set(key, { stamps, windowMs: rule.windowMs })
    if (this.hits.size > this.maxKeys) this.hits.delete(this.hits.keys().next().value!)
    return { ok: true, remaining: rule.limit - stamps.length, retryAfterMs: 0 }
  }

  /** Drops keys whose last request is out of their window */
  sweep(now = Date.now()) {
    for (const [key, { stamps, windowMs }] of this.hits) if ((stamps.at(-1) ?? 0) <= now - windowMs) this.hits.delete(key)
  }
}

/** Client IP from the proxy headers (Vercel sets them; the first `x-forwarded-for` entry is the client). */
export function clientIp(headers: Headers): string | null {
  const forwarded = (headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim()
  return forwarded || headers.get("x-real-ip")?.trim() || null
}

/**
 * Keys to count a request against: the route rule (per player, else per IP) and the per-IP ceiling.
 * Empty when the client can't be identified at all (no cookie, no IP): better not to limit than to put every such client in one bucket.
 */
export function rateLimitKeys(name: RateLimitName, client: { playerId?: string | null; ip?: string | null }): [string, RateLimitRule][] {
  const rule: RateLimitRule = RATE_LIMITS[name]
  const subject = rule.by !== "ip" && client.playerId ? `player:${client.playerId}` : client.ip ? `ip:${client.ip}` : null
  const keys: [string, RateLimitRule][] = []
  if (client.ip) keys.push([`ip:${client.ip}`, RATE_LIMITS.ip])
  if (subject) keys.push([`${name}:${subject}`, rule])
  return keys
}

/** Counts the request on every key; stops at the first refusal (the following keys are not charged). */
export async function checkRateLimit(store: RateLimitStore, keys: [string, RateLimitRule][], now = Date.now()): Promise<RateLimitResult> {
  let last: RateLimitResult = { ok: true, remaining: Infinity, retryAfterMs: 0 }
  for (const [key, rule] of keys) {
    const result = await store.hit(key, rule, now)
    if (!result.ok) return result
    last = { ok: true, remaining: Math.min(last.remaining, result.remaining), retryAfterMs: 0 }
  }
  return last
}
