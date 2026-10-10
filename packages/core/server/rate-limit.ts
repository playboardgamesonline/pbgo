import "server-only"
import { ApiError } from "./api"
import { getPlayerId } from "./player"
import { MemoryRateLimitStore, type RateLimitName, type RateLimitStore, checkRateLimit, clientIp, rateLimitKeys } from "./rate-limiter"

export { RATE_LIMITS, type RateLimitName, type RateLimitStore } from "./rate-limiter"

// In-memory, per server instance (see the LIMITATION note in `rate-limiter.ts`). Kept on globalThis so dev hot reloads don't reset it.
const holder = globalThis as { __pbgoRateLimitStore?: RateLimitStore }
holder.__pbgoRateLimitStore ??= new MemoryRateLimitStore()

/** Swaps the counter backend (e.g. an Upstash or Supabase implementation of `RateLimitStore`) for every route. */
export function setRateLimitStore(store: RateLimitStore) {
  holder.__pbgoRateLimitStore = store
}

/**
 * Throws `RATE_LIMITED` (429, with `Retry-After`) when the caller went over the `name` rule of `RATE_LIMITS` or the per-IP ceiling.
 * Call it first in the route, before any database work. `code` overrides the error code (feedback keeps `TOO_MANY_REQUESTS`).
 */
export async function rateLimit(request: Request, name: RateLimitName, options: { code?: string } = {}) {
  const keys = rateLimitKeys(name, { playerId: await getPlayerId(), ip: clientIp(request.headers) })
  const result = await checkRateLimit(holder.__pbgoRateLimitStore!, keys)
  if (!result.ok) throw new ApiError(options.code ?? "RATE_LIMITED", 429, { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))) })
}
