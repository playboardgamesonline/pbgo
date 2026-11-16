import { MAX_SEATS, SPEEDS, type Pace } from "./tables"

// The queue of a visitor who is looking for a table, for the buttons that start a search (a game's page, the signed-in home) and for the social panel, which both show it: the games they look for, whether the table is ranked or normal, and since when, the tables the search has
// sat them at and how full they are, the time they have waited as a counter ("0:12"), and the way a queue that was kept in the browser is read back. Pure, so that it is tested as it is. The hub keeps the queue in the page (`apps/web/src/lib/matchmaking.ts`) and the blocks draw
// what they are given. A queue lasts until a table of it begins or the visitor stops it.

/** How a table counts: a `ranked` one is played for the rank, a `normal` one is not. */
export type QueueMode = "ranked" | "normal"

/** Every mode, in the order the home offers them. */
export const QUEUE_MODES: readonly QueueMode[] = ["ranked", "normal"]

/** What each mode is called on a screen. */
export const QUEUE_MODE_LABELS: Record<QueueMode, string> = { ranked: "Ranked", normal: "Normal" }

/** What each mode is, in a line: a ranked table counts for the rank and has no helpers, a normal one does not change it. */
export const QUEUE_MODE_HINTS: Record<QueueMode, string> = { ranked: "Counts for your rank. No helpers.", normal: "Doesn't change your rank." }

/** A game a visitor looks for a table of. */
export type QueueGame = { slug: string; name: string }

/**
 * What a search asks of the tables of one game besides how they count: how fast they are played (a speed of a lobby; none asked is the usual one, and a ranked search is always played at it) and the expansions they are played with (the platform's slugs of the game's expansions;
 * none asked is none) and the most players at a table (`maxPlayers`, a whole number up to the most seats a table has: none asked is no limit, a table of any size the game has). A table that is played another way, or is set for more
 * players than that, is not sat at, and the one a search opens is played this way. Each is the visitor's choice for one game, in the settings of its tile on the home.
 */
export type QueueCriteria = { pace?: Pace; expansions?: string[]; maxPlayers?: number }

/** The most expansions a game's criteria hold: a game has a few, and what a browser keeps is anybody's. */
export const QUEUE_EXPANSIONS_MAX = 20

/** A table that a search has sat the visitor at: which one (a game and a code), where it is (`lobby` waits for players, the others have begun) and how many sit at it of those it is set for. */
export type QueueTable = { game: string; code: string; status: "lobby" | "starting" | "playing"; players: number; seats: number }

/** The games a visitor looks for (at least one), the kind of table they want, what they ask of the tables of each game (by slug: only the games that ask for something have an entry), the moment they started (milliseconds since the epoch) and, once the server has sat them down, the table they have for each game. */
export type Queue = { games: QueueGame[]; mode: QueueMode; since: number; criteria?: Record<string, QueueCriteria>; tables?: QueueTable[] }

/**
 * The longest a queue that was kept in the browser is still believed when the page is read back: a tab that was forgotten for hours says nothing the visitor wants any more. It is two hours,
 * and a queue that is older than that starts again from nothing.
 */
export const QUEUE_MAX_AGE_MS = 2 * 60 * 60 * 1000

/** The most games a queue holds when it is read back: the catalog is far under it, and a browser's storage is anybody's. */
export const QUEUE_MAX_GAMES = 100

/** The most tables a queue holds when it is read back: a search has one for each game it looks for. */
export const QUEUE_MAX_TABLES = 20

/** How far the fullest table of a search is from beginning, as the players seated and the seats it has; null while the search has sat the visitor nowhere. */
export function queueProgress(queue: Pick<Queue, "tables">): { players: number; seats: number } | null {
  const waiting = (queue.tables ?? []).filter((table) => table.status === "lobby")
  if (waiting.length === 0) return null
  const fullest = waiting.reduce((best, table) => (table.players / Math.max(1, table.seats) > best.players / Math.max(1, best.seats) ? table : best))
  return { players: fullest.players, seats: fullest.seats }
}

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
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100
const STATUSES: readonly QueueTable["status"][] = ["lobby", "starting", "playing"]
const isId = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value)

/** The criteria of one game as they were sent or kept, or null for anything that is not one: a speed that a lobby offers, expansions that are slugs, each listed once and `QUEUE_EXPANSIONS_MAX` at the most, a number of players that a table can have. A key that is not one of ours is left out. */
export function parseCriteria(raw: unknown): QueueCriteria | null {
  if (!isRecord(raw)) return null
  const criteria: QueueCriteria = {}
  if (raw.pace !== undefined) {
    if (typeof raw.pace !== "string" || !(SPEEDS as readonly string[]).includes(raw.pace)) return null
    criteria.pace = raw.pace as Pace
  }
  if (raw.expansions !== undefined) {
    if (!Array.isArray(raw.expansions) || raw.expansions.length > QUEUE_EXPANSIONS_MAX) return null
    const ids: string[] = []
    for (const id of raw.expansions) {
      if (!isId(id)) return null
      if (!ids.includes(id)) ids.push(id)
    }
    criteria.expansions = ids
  }
  if (raw.maxPlayers !== undefined) {
    if (typeof raw.maxPlayers !== "number" || !Number.isInteger(raw.maxPlayers) || raw.maxPlayers < 1 || raw.maxPlayers > MAX_SEATS) return null
    criteria.maxPlayers = raw.maxPlayers
  }
  return criteria
}

/**
 * What a search asks of each of its games, as it was sent or kept: an object by the slug of a game that is one of `slugs`, each value the criteria of that game (`parseCriteria`). Null for anything else (a game that is not in the search, a value that is not criteria), so that a request that
 * asks for what it does not look for is refused; nothing at all is `{}`. A game whose criteria ask for nothing is left out: the usual speed and no expansion is what every search asks.
 */
export function parseCriteriaOf(raw: unknown, slugs: readonly string[]): Record<string, QueueCriteria> | null {
  if (raw === undefined || raw === null) return {}
  if (!isRecord(raw)) return null
  const all: Record<string, QueueCriteria> = {}
  for (const [slug, value] of Object.entries(raw)) {
    const criteria = parseCriteria(value)
    if (!slugs.includes(slug) || !criteria) return null
    if (criteria.pace !== undefined && criteria.pace !== "normal") all[slug] = { ...all[slug], pace: criteria.pace }
    if (criteria.expansions !== undefined && criteria.expansions.length > 0) all[slug] = { ...all[slug], expansions: criteria.expansions }
    if (criteria.maxPlayers !== undefined) all[slug] = { ...all[slug], maxPlayers: criteria.maxPlayers }
  }
  return all
}

/** The tables a queue kept, each checked: what is not a table of a search is left out, so that the next answer of the server fills them again. */
function parseTables(raw: unknown): QueueTable[] {
  if (!Array.isArray(raw) || raw.length > QUEUE_MAX_TABLES) return []
  const tables: QueueTable[] = []
  for (const table of raw) {
    if (!isRecord(table) || !isLine(table.game) || !isLine(table.code) || table.code.length > 12) return []
    if (!STATUSES.some((status) => status === table.status) || !isCount(table.players) || !isCount(table.seats)) return []
    tables.push({ game: table.game, code: table.code, status: table.status as QueueTable["status"], players: table.players, seats: table.seats })
  }
  return tables
}

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
  const tables = parseTables(raw.tables)
  // What the search asked of its games is read the same way the server reads it, and left out when it is not one: the search goes on with the usual
  const criteria = parseCriteriaOf(raw.criteria, games.map((game) => game.slug)) ?? {}
  return { games, mode: raw.mode, since: raw.since, ...(Object.keys(criteria).length > 0 ? { criteria } : {}), ...(tables.length > 0 ? { tables } : {}) }
}
