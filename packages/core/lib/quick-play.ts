import { QUEUE_MODES, type QueueMode } from "@pbgo/ui/queue"
import type { Tier } from "@pbgo/ui/ranks"
import { defaultSeats } from "@pbgo/ui/tables"
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

/**
 * What the browser sends to look for a table: the games (slugs), how the table counts and, for a guest, the nickname they sit down under. A search asks again every few seconds while it lasts: `poll` says that this is one of those, not the press that began it,
 * and `waited` is how many seconds the visitor has waited, which only the events say.
 */
export type PlayRequest = { games: string[]; mode: PlayMode; nickname?: unknown; poll?: boolean; waited?: number }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const isSlug = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value)

/** The longest wait the events believe: a day. */
const WAITED_MAX = 24 * 60 * 60

const seconds = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? Math.min(WAITED_MAX, Math.max(0, Math.floor(value))) : undefined)

/** A request to look for tables as it was sent, or null for anything that is not one: the games are slugs, listed once, one at least and `SEARCH_MAX_GAMES` at the most, and the mode is one of ours. */
export function parsePlayRequest(raw: unknown): PlayRequest | null {
  if (!isRecord(raw) || !Array.isArray(raw.games) || raw.games.length === 0 || raw.games.length > SEARCH_MAX_GAMES) return null
  if (!PLAY_MODES.some((mode) => mode === raw.mode)) return null
  const games: string[] = []
  for (const game of raw.games) {
    if (!isSlug(game)) return null
    if (!games.includes(game)) games.push(game)
  }
  return { games, mode: raw.mode as PlayMode, nickname: raw.nickname, poll: raw.poll === true, waited: seconds(raw.waited) }
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

/** What a search sets a table it opens to: public, the usual speed and the value between the game's least and most players; a ranked one is marked and keeps the tier of the member who opened it, which the others are measured against. */
export function openingSettings(mode: PlayMode, range: { min: number; max: number }, tier: Tier): TableSettings {
  return { visibility: "public", pace: "normal", seats: defaultSeats(range.min, range.max), ...(mode === "ranked" ? { ranked: true, anchor: tier } : {}) }
}

/** A public lobby a search may sit at: which table it is, who sits at it, what it was set to and when it was opened (ISO time). */
export type Lobby = {
  game: string
  code: string
  players: ReadonlyArray<{ id: string; left?: boolean }>
  settings: TableSettings
  createdAt: string
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
  /** The lobbies where the visitor sits already (`lobbyKey`): they are theirs, not a find. */
  mine: ReadonlySet<string>
  now: number
}

/**
 * The lobbies a search may sit at, the one to take first at the head: those of this mode (a ranked search never joins a normal table, nor the other way round) that are played at the usual speed, that the visitor does not sit at, that have a seat free and whose
 * criteria they meet (`unmetCriteria`: the rank and the language the host asked, and, for a ranked table, the gap from the tier it opened at, which widens with the time it has waited). The fullest comes first, so that tables fill and begin; of two as full, the older.
 */
export function rankLobbies<L extends Lobby>(lobbies: readonly L[], choice: Choice): L[] {
  return lobbies
    .filter((lobby) => {
      if (modeOf(lobby.settings) !== choice.mode) return false
      if ((lobby.settings.pace ?? "normal") !== "normal") return false
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
