import { parseCriteriaOf, QUEUE_MODES, type QueueCriteria, type QueueMode } from "@pbgo/ui/queue"
import type { Tier } from "@pbgo/ui/ranks"
import { defaultSeats, MAX_SEATS, type Pace } from "@pbgo/ui/tables"
import { effectiveSettings, modeOf, unmetCriteria, type TableSettings, type Viewer } from "./table-settings"

// The search of a visitor who presses Play (PLT-21, phase C): for each game they picked they sit at a public lobby that waits for players, or open one, and the table that fills first is the one they play. These are the rules of it, pure and
// tested, which the server (`server/quick-play.ts`) and the browser (`apps/web/src/lib/matchmaking.ts`) read the same way.

/** How a search counts: `ranked` tables are played for the rank, `normal` ones are not. The two never meet at a table. */
export type PlayMode = QueueMode

export const PLAY_MODES: readonly PlayMode[] = QUEUE_MODES

/** The most games one search looks for: it sits the visitor at a table of each, so the number is kept small. */
export const SEARCH_MAX_GAMES = 10

/** The routes of the search: it belongs to no game, the visitor's seat at each game being the one their cookie of that game stands for. */
export const PLAY_PATH = "/api/hub/play"
export const PLAY_CANCEL_PATH = "/api/hub/play/cancel"

/** A table of a search, as the browser is told of it: which one, how far it is from beginning and whether this request opened it. */
export type PlayTable = {
  game: string
  code: string
  /** `lobby` waits for players, `starting` is in its ready check and `playing` is begun: the last two take the visitor to the board. */
  status: "lobby" | "starting" | "playing"
  /** The people seated (a seat that left a game in progress does not count). */
  players: number
  /** How many players the table is set for. */
  seats: number
  mode: PlayMode
  opened: boolean
}

/** What a search answers: the table the visitor sits at for each game they picked (one at most), or the one they are playing. */
export type PlayState = { tables: PlayTable[] }

/** What a search asks of the tables of one game besides how they count: how fast they are played, which expansions they have and the most players they are set for (`QueueCriteria`). */
export type PlayCriteria = QueueCriteria

/**
 * What the browser sends to look for a table: the games (slugs), how the table counts, what it asks of the tables of each game (`criteria`, by slug, only for a game that asks for something) and, for a guest, the nickname they sit down under. A search asks again every few seconds
 * while it lasts: `poll` says that this is one of those, not the press that began it, and `waited` is how many seconds the visitor has waited, which only the events say.
 */
export type PlayRequest = { games: string[]; mode: PlayMode; criteria?: Record<string, PlayCriteria>; nickname?: unknown; poll?: boolean; waited?: number }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const isSlug = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value)

/** The longest wait the events believe: a day. */
const WAITED_MAX = 24 * 60 * 60

const seconds = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? Math.min(WAITED_MAX, Math.max(0, Math.floor(value))) : undefined)

/**
 * A request to look for tables as it was sent, or null for anything that is not one: the games are slugs, listed once, one at least and `SEARCH_MAX_GAMES` at the most, the mode is one of ours, and what is asked of the tables (`criteria`) is asked of games that are in the search
 * (a speed a lobby offers, expansions that are slugs: `parseCriteriaOf`).
 */
export function parsePlayRequest(raw: unknown): PlayRequest | null {
  if (!isRecord(raw) || !Array.isArray(raw.games) || raw.games.length === 0 || raw.games.length > SEARCH_MAX_GAMES) return null
  if (!PLAY_MODES.some((mode) => mode === raw.mode)) return null
  const games: string[] = []
  for (const game of raw.games) {
    if (!isSlug(game)) return null
    if (!games.includes(game)) games.push(game)
  }
  const criteria = parseCriteriaOf(raw.criteria, games)
  if (!criteria) return null
  return { games, mode: raw.mode as PlayMode, ...(Object.keys(criteria).length > 0 ? { criteria } : {}), nickname: raw.nickname, poll: raw.poll === true, waited: seconds(raw.waited) }
}

/** The tables a visitor stops looking at: a game and a code each, as the search told them, and for the events how they were looking and for how long. */
export type CancelRequest = { tables: { game: string; code: string }[]; mode?: PlayMode; waited?: number }

/** A request to stop a search as it was sent, or null: up to `SEARCH_MAX_GAMES` tables, each a game and a code. */
export function parseCancelRequest(raw: unknown): CancelRequest | null {
  if (!isRecord(raw) || !Array.isArray(raw.tables) || raw.tables.length > SEARCH_MAX_GAMES) return null
  const tables: CancelRequest["tables"] = []
  for (const table of raw.tables) {
    if (!isRecord(table) || !isSlug(table.game) || typeof table.code !== "string" || table.code.length < 1 || table.code.length > 12) return null
    tables.push({ game: table.game, code: table.code })
  }
  return { tables, mode: PLAY_MODES.find((mode) => mode === raw.mode), waited: seconds(raw.waited) }
}

/**
 * What a search sets a table it opens to: public, the speed it asks (the usual one unless it asks another, and a ranked table is always played at the usual one) and the value between the game's least and most players, kept under the most players the search accepts (`maxSeats`) and never under the
 * game's least; a ranked one is marked and keeps the tier of the member who opened it, which the others are measured against.
 */
export function openingSettings(mode: PlayMode, range: { min: number; max: number }, tier: Tier, pace: Pace = "normal", maxSeats: number = Number.POSITIVE_INFINITY): TableSettings {
  const seats = Math.max(range.min, Math.min(defaultSeats(range.min, range.max), maxSeats))
  return { visibility: "public", pace: mode === "ranked" ? "normal" : pace, seats, ...(mode === "ranked" ? { ranked: true, anchor: tier } : {}) }
}

/**
 * What a search wants of the tables of one game, as the server has worked it out: the speed, the expansions the game offers (`offered`: the ones that a table can switch on, that is those that the engine has an option for and the gamemaster did not hide) and the ones of them that
 * the tables must have on, the others being off, and the most seats a table may be set for (`maxSeats`, none: any). A table is sat at only if it is played this way, and the one a search opens is.
 */
export type Wanted = { pace: Pace; offered: readonly string[]; expansions: readonly string[]; maxSeats?: number }

/** What a search that asks nothing of a game wants: the usual speed and no expansion. */
export const USUAL_WANTED: Wanted = { pace: "normal", offered: [], expansions: [] }

/** The most seats a search accepts at a table of a game: the number it asks (`maxPlayers`), or none. */
export const wantedMaxSeats = (criteria: PlayCriteria | undefined): number | undefined => criteria?.maxPlayers

/** The speed a search wants of a game's tables: the one it asks, and always the usual one for a ranked search, whose tables are fixed. */
export const wantedPace = (mode: PlayMode, criteria: PlayCriteria | undefined): Pace => (mode === "ranked" ? "normal" : (criteria?.pace ?? "normal"))

/** A public lobby a search may sit at: which table it is, who sits at it, what it was set to, the options it is played with and when it was opened (ISO time). A lobby with no options is played with none on. */
export type Lobby = {
  game: string
  code: string
  players: ReadonlyArray<{ id: string; left?: boolean }>
  settings: TableSettings
  options?: Readonly<Record<string, unknown>>
  createdAt: string
}

/**
 * Whether a table is played the way a search wants: at the speed it asks, not set for more seats than it accepts (`gameMax` is the game's most players, the seats of a table that kept none), and with the expansions it asks on and the other expansions of the game off. An option that is not one of the
 * game's expansions is not looked at.
 */
export function matchesWanted(table: Pick<Lobby, "settings" | "options">, wanted: Wanted, gameMax: number = MAX_SEATS): boolean {
  if ((table.settings.pace ?? "normal") !== wanted.pace) return false
  if (wanted.maxSeats !== undefined && effectiveSettings(table.settings, gameMax).seats > wanted.maxSeats) return false
  return wanted.offered.every((id) => (table.options?.[id] === true) === wanted.expansions.includes(id))
}

/** `<game>:<code>`: the same table has the same key wherever it is listed. */
export const lobbyKey = (lobby: Pick<Lobby, "game" | "code">): string => `${lobby.game}:${lobby.code}`

/** How many people sit at a lobby: those who have not left. */
export const seated = (lobby: Pick<Lobby, "players">): number => lobby.players.filter((player) => player.left !== true).length

const openedAt = (lobby: Pick<Lobby, "createdAt">): number => {
  const time = Date.parse(lobby.createdAt)
  return Number.isFinite(time) ? time : 0
}

/** Whether `a` was opened before `b`: the older table wins, and the code settles two that were opened at the same instant, so that two searchers who see each other's table agree on which one stays. */
export const isOlder = (a: Pick<Lobby, "createdAt" | "code">, b: Pick<Lobby, "createdAt" | "code">): boolean => openedAt(a) < openedAt(b) || (openedAt(a) === openedAt(b) && a.code < b.code)

/** What the choice of a lobby needs to know of the visitor and of the games. */
export type Choice = {
  mode: PlayMode
  /** What the visitor is, as far as the criteria of a table go, in a game (their tier there, their language). */
  viewer: (game: string) => Viewer
  /** The most players a game takes: the seats of a table that kept none. */
  maxOf: (game: string) => number
  /** What the search wants of the tables of a game: the speed and the expansions. */
  wanted: (game: string) => Wanted
  /** The lobbies where the visitor sits already (`lobbyKey`): they are theirs, not a find. */
  mine: ReadonlySet<string>
  now: number
}

/**
 * The lobbies a search may sit at, the one to take first at the head: those of this mode (a ranked search never joins a normal table, nor the other way round) that are played the way the search wants (`matchesWanted`: the speed, the most seats and the expansions, the usual speed and none by default),
 * that the visitor does not sit at, that have a seat free and whose criteria they meet (`unmetCriteria`: the rank and the language the host asked, and, for a ranked table, the gap from the tier it opened at, which widens with the time it has waited). The fullest comes first,
 * so that tables fill and begin; of two as full, the older.
 */
export function rankLobbies<L extends Lobby>(lobbies: readonly L[], choice: Choice): L[] {
  return lobbies
    .filter((lobby) => {
      if (modeOf(lobby.settings) !== choice.mode) return false
      if (!matchesWanted(lobby, choice.wanted(lobby.game), choice.maxOf(lobby.game))) return false
      if (choice.mine.has(lobbyKey(lobby))) return false
      if (seated(lobby) >= effectiveSettings(lobby.settings, choice.maxOf(lobby.game)).seats) return false
      return unmetCriteria(lobby.settings, choice.viewer(lobby.game), choice.now - openedAt(lobby)) === null
    })
    .sort((a, b) => seated(b) - seated(a) || (isOlder(a, b) ? -1 : isOlder(b, a) ? 1 : 0))
}

/**
 * The lobby a visitor who sits alone at one should move to: the first of the ones they may sit at (`rankLobbies`) that already has somebody and was opened before theirs. Two searchers who each opened a table at the same moment would never meet
 * otherwise; as the older table always stays, they agree on which one, and nobody moves back and forth. Null when theirs is the one to stay at.
 */
export function olderLobby<L extends Lobby>(mine: Pick<Lobby, "createdAt" | "code">, ranked: readonly L[]): L | null {
  return ranked.find((lobby) => seated(lobby) >= 1 && isOlder(lobby, mine)) ?? null
}

/**
 * Which of the lobbies of one kind that a visitor sits at stays, when there are several. A search keeps the visitor at one lobby of a game and a kind, so a second one is a twin: two calls of the same visitor at the same moment (two tabs, a press while a call that keeps the
 * search alive is on its way) each found nothing of theirs and each opened one. The fullest stays, then the older, so that the calls agree on the same one; the others are given up when the visitor sits alone at them, and never when somebody sits with them.
 */
export function settleOwn<L extends Pick<Lobby, "createdAt" | "code" | "players">>(own: readonly L[]): { stay: L | null; spares: L[] } {
  const [stay = null, ...others] = [...own].sort((a, b) => seated(b) - seated(a) || (isOlder(a, b) ? -1 : isOlder(b, a) ? 1 : 0))
  return { stay, spares: others.filter((lobby) => seated(lobby) <= 1) }
}
