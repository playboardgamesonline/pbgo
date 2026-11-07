// The queue of a visitor who is looking for a table, for the buttons that start a search (a game's page, the signed-in home) and for the social panel, which both show it: the games they look for, whether the table is ranked or normal, and since when, the time they have waited as a
// counter ("0:12"), and the way a queue that was kept in the browser is read back. Pure, so that it is tested as it is. The hub keeps the queue in the page (`apps/web/src/lib/matchmaking.ts`) and the blocks draw what they are given. No game is found for
// them yet: nothing matches players, so a queue lasts until the visitor stops it.

/** How a table counts: a `ranked` one is played for the rank, a `normal` one is not. */
export type QueueMode = "ranked" | "normal"

/** Every mode, in the order the home offers them. */
export const QUEUE_MODES: readonly QueueMode[] = ["ranked", "normal"]

/** What each mode is called on a screen. */
export const QUEUE_MODE_LABELS: Record<QueueMode, string> = { ranked: "Ranked", normal: "Normal" }

/** A game a visitor looks for a table of. */
export type QueueGame = { slug: string; name: string }

/** The games a visitor looks for (at least one), the kind of table they want, and the moment they started (milliseconds since the epoch). */
export type Queue = { games: QueueGame[]; mode: QueueMode; since: number }

/**
 * The longest a queue that was kept in the browser is still believed when the page is read back: a tab that was forgotten for hours says nothing the visitor wants any more. It is two hours,
 * and a queue that is older than that starts again from nothing.
 */
export const QUEUE_MAX_AGE_MS = 2 * 60 * 60 * 1000

/** The most games a queue holds when it is read back: the catalog is far under it, and a browser's storage is anybody's. */
export const QUEUE_MAX_GAMES = 100

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

/** The games of a queue in a few words: all of them up to three ("Courtisans", "A and B", "A, B and C"), then the first two and how many more ("A, B and 2 more"). */
export function queueGamesLabel(games: readonly Pick<QueueGame, "name">[]): string {
  const names = games.map((game) => game.name)
  if (names.length <= 3) return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const isLine = (value: unknown): value is string => typeof value === "string" && value.trim() !== "" && value.length <= 80 && !/\p{Cc}/u.test(value)
const isMode = (value: unknown): value is QueueMode => QUEUE_MODES.some((mode) => mode === value)

/**
 * A queue as it was kept, or null for anything that is not one: what a browser holds is anything someone put there or an older version left (a queue of one game with no mode, as the first version kept it, is not read: the visitor
 * simply is not searching any more), so each field is checked, and a queue that began in the future (a clock that moved) or longer ago than `QUEUE_MAX_AGE_MS` is not one either. A game is listed once.
 */
export function parseQueue(raw: unknown, now: number): Queue | null {
  if (!isRecord(raw) || !Array.isArray(raw.games) || raw.games.length === 0 || raw.games.length > QUEUE_MAX_GAMES) return null
  if (!isMode(raw.mode) || typeof raw.since !== "number" || !Number.isFinite(raw.since)) return null
  if (raw.since > now + 60_000 || now - raw.since > QUEUE_MAX_AGE_MS) return null
  const games: QueueGame[] = []
  for (const game of raw.games) {
    if (!isRecord(game) || !isLine(game.slug) || !isLine(game.name) || games.some((known) => known.slug === game.slug)) return null
    games.push({ slug: game.slug, name: game.name })
  }
  return { games, mode: raw.mode, since: raw.since }
}
