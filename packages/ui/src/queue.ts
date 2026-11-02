// The queue of a visitor who is looking for a game, for the button of a game's page and for the social panel, which both show it: the game they look for and since when, the time they have waited as a counter ("0:12"), and the way a
// queue that was kept in the browser is read back. Pure, so that it is tested as it is. The hub keeps the queue in the page (`apps/web/src/lib/matchmaking.ts`) and the blocks draw what they are given. No game is found for
// them yet: nothing matches players, so a queue lasts until the visitor stops it.

/** The game a visitor looks for, and the moment they started (milliseconds since the epoch). */
export type Queue = { slug: string; name: string; since: number }

/**
 * The longest a queue that was kept in the browser is still believed when the page is read back: a tab that was forgotten for hours says nothing the visitor wants any more. It is two hours,
 * and a queue that is older than that starts again from nothing.
 */
export const QUEUE_MAX_AGE_MS = 2 * 60 * 60 * 1000

/** How long the visitor has waited, in whole seconds: never negative, whatever their clock says. */
export function queueSeconds(queue: Pick<Queue, "since">, now: number): number {
  return Math.max(0, Math.floor((now - queue.since) / 1000))
}

/** The time waited as a counter: minutes and seconds ("0:12", "12:05"), with hours once there are some ("1:02:03"). */
export function queueTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, "0")
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const isLine = (value: unknown): value is string => typeof value === "string" && value.trim() !== "" && value.length <= 80 && !/\p{Cc}/u.test(value)

/**
 * A queue as it was kept, or null for anything that is not one: what a browser holds is anything someone put there or an older version left, so each field is checked, and a queue that began in the future
 * (a clock that moved) or longer ago than `QUEUE_MAX_AGE_MS` is not one either.
 */
export function parseQueue(raw: unknown, now: number): Queue | null {
  if (!isRecord(raw) || !isLine(raw.slug) || !isLine(raw.name) || typeof raw.since !== "number" || !Number.isFinite(raw.since)) return null
  if (raw.since > now + 60_000 || now - raw.since > QUEUE_MAX_AGE_MS) return null
  return { slug: raw.slug, name: raw.name, since: raw.since }
}
