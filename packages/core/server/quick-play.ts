import "server-only"
import { after } from "next/server"
import { getAccount } from "@pbgo/accounts/server"
import { TIERS, type Tier } from "@pbgo/ui/ranks"
import type { AgeRulesSource } from "../lib/age-rules"
import type { PlayableGame } from "../lib/binding"
import type { GameStatus } from "../lib/game-types"
import { olderLobby, openingSettings, rankLobbies, seated, type CancelRequest, type Lobby, type PlayMode, type PlayRequest, type PlayState, type PlayTable } from "../lib/quick-play"
import { gameOptions } from "../lib/settings"
import { loadSettings } from "../lib/settings-server"
import { asksSomething, effectiveSettings, modeOf, tierOf, type TableSettings, type Viewer } from "../lib/table-settings"
import { ageGateFor, type AgeGate } from "./age-gate"
import { trackAfter } from "./analytics"
import { ApiError } from "./api"
import { normalizeCode } from "./code"
import type { GameRow } from "./games"
import { getOrCreatePlayerId, getPlayerId } from "./player"
import { markSeen } from "./presence"
import { actorOf, profileOf, type Actor } from "./profile"
import { rateLimit } from "./rate-limit"
import { readPlayerStanding } from "./standings"
import { joinTable, leaveLobby, openTable, startWhenFull, type Sitter } from "./table-seat"
import { readTableSettings, visitorLanguage } from "./table-settings"
import { readMemberTables, readPlayerTables, readPublicTables, type MemberTable } from "./tables"
import { SEEN_WRITE_EVERY_MS } from "./takeover"

// The search of a visitor who presses Play (PLT-21, phase C). For each game they picked, they sit at a public lobby that waits for players, or open one, so that the first table to fill is the one they play: it begins by itself (`startWhenFull`), and the
// players who play it leave their other lobbies (`leaveOtherLobbies`, when its ready check is done). The browser asks again every few seconds while the search lasts, so that one call does all three things: it begins the search, it keeps the visitor's
// seats alive (a lobby is listed while somebody who sits at it was seen lately) and it says where the tables are. The rules of the choice are in `lib/quick-play.ts`.
//
// A normal search sits the visitor at normal tables, a ranked one at ranked tables, and the two never meet. A ranked table is opened with no helpers, the game's seats, and the tier of the member who opened it, which the others are measured against; it is for
// members only and nothing in it changes (`isLocked`).

/** What the app hands the search in: it needs the games (registry), the age they ask (catalog) and which of their options are helpers (catalog), none of which core can read itself. */
export type PlayDeps = {
  ageRules: AgeRulesSource
  /** The game of a slug when it can be played here, else null. */
  loadGame: (slug: string) => Promise<PlayableGame | null>
  /** The keys of the options of a game that are its helpers: a ranked table is opened with them off. */
  helpersOf: (slug: string) => Promise<readonly string[]>
}

/** How many lobbies a search tries to sit at in a game before it opens one: the fullest first, and only the ones that were taken by somebody else in the meantime are given up. */
const TRIES = 5

/** What the search knows once, and every game of it uses. */
type Search = {
  deps: PlayDeps
  request: Request
  mode: PlayMode
  actor: Actor
  account: Awaited<ReturnType<typeof getAccount>>
  nickname: unknown
  mine: MemberTable[]
  now: number
}

/** A table of the search and the seat the visitor has at it (the id of their cookie of the game): the seat is what the events and the keep-alive are for. */
type Found = { table: PlayTable; seat: string; hostId: string }

/** The visitor's seat at a game and the name they sit down under. A guest who gave no nickname cannot sit down (400 `INVALID_NICKNAME`). */
async function sitterFor(search: Search, game: PlayableGame): Promise<Sitter> {
  return { id: await getOrCreatePlayerId(game.slug), profile: profileOf(search.account, { nickname: search.nickname }), memberId: search.actor.memberId }
}

/** The tables the visitor sits at: a member's, in every game (`member_tables`); a guest's, in the games they look for (they are known by the cookie of the game alone). A member's seat is the same cookie, so the games' own tables are the fallback when the database cannot say. */
async function tablesOf(actor: Actor, slugs: readonly string[]): Promise<MemberTable[]> {
  if (actor.memberId) {
    try {
      return await readMemberTables(actor.memberId)
    } catch (error) {
      console.error("The tables of a member could not be read", error instanceof Error ? error.message : error)
    }
  }
  const byGame = await Promise.all(
    slugs.map(async (slug) => {
      const id = await getPlayerId(slug)
      return id ? readPlayerTables(slug, id).catch(() => []) : []
    }),
  )
  return byGame.flat()
}

/** The tier of the visitor in a game: their rank's, the lowest for a guest and for a member who never played it ranked or whose rank cannot be read. */
async function tierIn(search: Search, slug: string): Promise<Tier> {
  if (!search.actor.memberId) return TIERS[0]
  try {
    return tierOf((await readPlayerStanding(search.actor.memberId, slug)).rank)
  } catch (error) {
    console.error("The rank of a member could not be read", { game: slug }, error instanceof Error ? error.message : error)
    return TIERS[0]
  }
}

/** What the visitor is, as far as the lobbies of a game ask: only what one of them asks is looked up (the rank for a ranked search or a lobby that asks one, the language for a lobby that asks one). */
async function viewerIn(search: Search, slug: string, lobbies: readonly Lobby[]): Promise<Viewer> {
  const needsTier = search.mode === "ranked" || lobbies.some((lobby) => lobby.settings.minRank !== undefined)
  const needsLanguage = lobbies.some((lobby) => lobby.settings.language !== undefined)
  const [tier, language] = await Promise.all([needsTier ? tierIn(search, slug) : TIERS[0], needsLanguage ? visitorLanguage() : ("en" as const)])
  return { tier, language }
}

/** The options a search opens a table with: the admin's defaults, and, for a ranked table, no helpers. */
async function optionsFor(search: Search, game: PlayableGame): Promise<ReturnType<typeof gameOptions>> {
  const defaults = gameOptions(game.binding, (await loadSettings(game)).options)
  if (search.mode !== "ranked") return defaults
  const off = Object.fromEntries((await search.deps.helpersOf(game.slug)).filter((key) => key in defaults).map((key) => [key, false]))
  return { ...defaults, ...off }
}

/** How a table is told to the browser. A table that has begun is as full as it is. */
function tableOf(slug: string, table: { code: string; status: GameStatus; players: readonly { left?: boolean }[] }, settings: TableSettings, maxPlayers: number, opened: boolean): PlayTable {
  const players = table.players.filter((player) => player.left !== true).length
  const status = table.status === "lobby" || table.status === "starting" ? table.status : "playing"
  return { game: slug, code: table.code, status, players, seats: status === "lobby" ? effectiveSettings(settings, maxPlayers).seats : players, mode: modeOf(settings), opened }
}

/** Seats of the last minutes whose last-seen time was written, by instance: a search asks every few seconds, and the seat of a lobby is written every `SEEN_WRITE_EVERY_MS` at most. */
const touched = new Map<string, number>()

/** Records that the visitor is at their table just now (`games.seen`), so that their lobby stays listed while they look. After the response, throttled, never throws. */
function keepAlive(slug: string, table: Pick<MemberTable, "code" | "players">, seat: string): void {
  const now = Date.now()
  const key = `${slug}:${table.code}:${seat}`
  if (now - (touched.get(key) ?? 0) < SEEN_WRITE_EVERY_MS) return
  if (touched.size > 5_000) touched.clear()
  touched.set(key, now)
  try {
    after(() => markSeen({ slug }, { code: table.code, players: table.players, seen: undefined }, seat, now))
  } catch (error) {
    console.error("A seat could not be kept alive", { game: slug }, error instanceof Error ? error.message : error)
  }
}

/** Tries to sit the visitor at a lobby: null when it cannot be done any more (the table filled, began or went, or what it asks is not met, or the age), which sends the search to the next one. A seat that fills the table begins the game. */
async function tryJoin(search: Search, game: PlayableGame, gate: AgeGate, lobby: Lobby, viewer: Viewer, maxPlayers: number): Promise<Found | null> {
  const sitter = await sitterFor(search, game)
  try {
    const { row, added } = await joinTable(game, lobby.code, sitter, { gate, maxPlayers, settings: lobby.settings, viewer: asksSomething(lobby.settings) ? viewer : null })
    const current: GameRow = added ? await startWhenFull(game, row, { id: sitter.id, actor: search.actor }, { ageRules: search.deps.ageRules, settings: lobby.settings }) : row
    keepAlive(game.slug, current, sitter.id)
    return { table: tableOf(game.slug, current, lobby.settings, maxPlayers, false), seat: sitter.id, hostId: current.host_id }
  } catch (error) {
    if (error instanceof ApiError) return null
    throw error
  }
}

/** Opens a lobby of the search: public, at the usual speed, with the game's seats (`openingSettings`). Opening is as limited as opening a table by hand. */
async function open(search: Search, game: PlayableGame, gate: AgeGate, range: { min: number; max: number }, options: Awaited<ReturnType<typeof optionsFor>>): Promise<Found> {
  await rateLimit(game.slug, search.request, "create")
  const sitter = await sitterFor(search, game)
  const settings = openingSettings(search.mode, range, search.mode === "ranked" ? await tierIn(search, game.slug) : TIERS[0])
  const row = await openTable(game, sitter, { gate, options, settings, ranked: search.mode === "ranked", maxPlayers: range.max })
  keepAlive(game.slug, row, sitter.id)
  return { table: tableOf(game.slug, row, settings, range.max, true), seat: sitter.id, hostId: row.host_id }
}

/** The table of the search for one game: the lobby the visitor sits at already (and, when they sit there alone, the older one they should move to), else one to sit at, else a new one. */
async function searchGame(search: Search, game: PlayableGame): Promise<Found> {
  const { minPlayers, maxPlayers } = await loadSettings(game)
  const gate = await ageGateFor(search.deps.ageRules, game, search.actor)
  const held = search.mine.filter((table) => table.game === game.slug && table.status === "lobby")
  const [kept, lobbies] = await Promise.all([readTableSettings(game.slug, held.map((table) => table.code)), readPublicTables(game.slug)])
  const mineHere = held.find((table) => {
    const settings = kept.get(table.code) ?? {}
    return settings.visibility === "public" && modeOf(settings) === search.mode
  })
  const viewer = await viewerIn(search, game.slug, lobbies)
  const candidates = rankLobbies(lobbies, { mode: search.mode, viewer: () => viewer, maxOf: () => maxPlayers, mine: new Set(held.map((table) => `${table.game}:${table.code}`)), now: search.now })

  if (mineHere) {
    const settings = kept.get(mineHere.code) ?? {}
    const here: Lobby = { game: game.slug, code: mineHere.code, players: mineHere.players, settings, createdAt: mineHere.createdAt }
    // Alone at a lobby while an older one has somebody: two searchers who opened a table at the same moment would never meet otherwise
    const better = seated(here) === 1 ? olderLobby(here, candidates) : null
    const moved = better ? await tryJoin(search, game, gate, better, viewer, maxPlayers) : null
    if (moved) {
      await leaveLobby(game, mineHere.code, mineHere.seat)
      return moved
    }
    keepAlive(game.slug, mineHere, mineHere.seat)
    return { table: tableOf(game.slug, mineHere, settings, maxPlayers, false), seat: mineHere.seat, hostId: mineHere.hostId }
  }

  for (const lobby of candidates.slice(0, TRIES)) {
    const joined = await tryJoin(search, game, gate, lobby, viewer, maxPlayers)
    if (joined) return joined
  }
  // Nothing to sit at: a table of the game is opened, if the visitor may sit at it (the age of the game)
  const options = await optionsFor(search, game)
  gate.assertMay(gate.tableAge(options))
  return open(search, game, gate, { min: minPlayers, max: maxPlayers }, options)
}

/**
 * `POST /api/hub/play`: the visitor looks for a table of each game they picked, in the mode they chose. The answer is the table they sit at for each game (one at most), or the one they are playing when they are in a game: the browser takes them to its board
 * once a table has begun. Asking again changes nothing while the tables are as they were, which is how the browser keeps the search alive. Refused: a ranked search for somebody who is not a member (403 `RANKED_MEMBERS_ONLY`), no game that can be played
 * (404 `GAME_NOT_FOUND`) and, when no game could be sat at, the first reason that was given (the age of a game, a guest's missing nickname, the limit on opening tables).
 */
export async function playSearch(deps: PlayDeps, request: Request, input: PlayRequest): Promise<PlayState> {
  const account = await getAccount()
  const actor = actorOf(account)
  if (input.mode === "ranked" && actor.memberId === null) throw new ApiError("RANKED_MEMBERS_ONLY", 403)
  const games = (await Promise.all(input.games.map((slug) => deps.loadGame(slug)))).filter((game): game is PlayableGame => game !== null)
  if (games.length === 0) throw new ApiError("GAME_NOT_FOUND", 404)
  const mine = await tablesOf(actor, games.map((game) => game.slug))
  const search: Search = { deps, request, mode: input.mode, actor, account, nickname: input.nickname, mine, now: Date.now() }

  // A visitor who plays, or whose table is in its ready check, is taken there, whatever they look for
  const playing = mine.find((table) => table.status === "starting" || table.status === "playing")
  let found: Found[]
  if (playing) {
    const [settings] = (await readTableSettings(playing.game, [playing.code])).values()
    found = [{ table: tableOf(playing.game, playing, settings ?? {}, playing.players.length, false), seat: playing.seat, hostId: playing.hostId }]
  } else {
    const results = await Promise.allSettled(games.map((game) => searchGame(search, game)))
    found = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    // A game that could not be sat at for a reason of the rules (its age, the limit on opening) is left out; one that failed for another is told
    for (const result of results) if (result.status === "rejected" && !(result.reason instanceof ApiError)) console.error("A game of a search could not be sat at", result.reason instanceof Error ? result.reason.message : result.reason)
    if (found.length === 0) {
      const refused = results.find((result): result is PromiseRejectedResult => result.status === "rejected")
      throw refused?.reason ?? new ApiError("GAME_NOT_FOUND", 404)
    }
    // The same events as the other routes say where a table came from; these say a search began, and that one was matched
    if (!input.poll) trackAfter("quick_play_started", found[0]!.seat, { mode: input.mode, games: games.map((game) => game.slug) })
  }
  const matched = found.find(({ table }) => table.status !== "lobby")
  if (matched && input.waited !== undefined) {
    trackAfter("quick_play_matched", matched.seat, { game: matched.table.game, mode: matched.table.mode, how: matched.hostId === matched.seat ? "opened" : "joined", wait_s: input.waited, players: matched.table.players })
  }
  return { tables: found.map(({ table }) => table) }
}

/**
 * `POST /api/hub/play/cancel`: the visitor stops looking: they leave the lobbies the search sat them at (the ones the browser lists), each with the seat their cookie of that game stands for. A table that has begun is not left this way, and a table they do not
 * sit at changes nothing. Says how many lobbies they left.
 */
export async function playCancel(input: CancelRequest): Promise<{ left: number }> {
  const done = { left: 0, seat: null as string | null }
  await Promise.all(
    input.tables.map(async ({ game, code }) => {
      const id = await getPlayerId(game)
      if (!id) return
      done.seat ??= id
      try {
        if (await leaveLobby({ slug: game }, normalizeCode(code), id)) done.left += 1
      } catch (error) {
        console.error("A lobby of a search could not be left", { game }, error instanceof Error ? error.message : error)
      }
    }),
  )
  if (input.mode && done.seat) trackAfter("quick_play_cancelled", done.seat, { mode: input.mode, games: input.tables.map((table) => table.game), ...(input.waited !== undefined ? { wait_s: input.waited } : {}) })
  return { left: done.left }
}
