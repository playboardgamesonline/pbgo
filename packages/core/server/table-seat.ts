import "server-only"
import { after } from "next/server"
import type { OptionValues } from "@pbgo/engine-kit"
import type { AgeRulesSource } from "../lib/age-rules"
import type { PlayableGame } from "../lib/binding"
import { getLocale } from "../lib/locale-server"
import { loadSettings } from "../lib/settings-server"
import { effectiveSettings, unmetCriteria, UNMET_CODES, type TableSettings, type Viewer } from "../lib/table-settings"
import { ageGateFor, type AgeGate } from "./age-gate"
import { trackAfter } from "./analytics"
import { ApiError } from "./api"
import { createGame, deleteEmptyTable, loadSetupData, newGame, readGame, settleReadyCheck, updateGame, type GameRow } from "./games"
import { seatMember } from "./presence"
import type { Actor, Profile } from "./profile"
import { startingPatch } from "./ready"
import { leavePatch, sameSeats, seatedPlayers } from "./table-rules"
import { readTableSettingsOf } from "./table-settings"
import { busySeats, readMemberTables, readPlayerTables } from "./tables"
import { supabaseAdmin } from "./supabase"

// What is done to a table of the platform, in one place: somebody sits down at it, one is opened, it begins, somebody leaves a lobby. The routes of a game (create, join, start, ready) and the search of a visitor who presses Play (`server/quick-play.ts`)
// both do these, so they do them the same way.

type GameRef = Pick<PlayableGame, "slug">

/** Who sits down: their seat (the id of the cookie of the game), the name and the picture the others see, and the account that holds the seat (null for a guest). */
export type Sitter = { id: string; profile: Profile; memberId: string | null }

/** A member's seat says whose it is, for the players online: apart from the table the others see, and after the response. A game that has an age to ask is the exception: the host may switch an expansion for adults on at any moment, and that check reads who sits where, so the seat is written first. */
async function recordSeat(game: GameRef, code: string, sitter: Sitter, gate: AgeGate): Promise<void> {
  if (gate.restricted) await seatMember(game, code, sitter.id, sitter.memberId)
  else after(() => seatMember(game, code, sitter.id, sitter.memberId))
}

/** What sitting down at a table is checked against: the age gate of the visitor, how many players the game takes, what the host set for the table and, for a table that asks something, what the visitor is (`viewerFor`). */
export type JoinChecks = { gate: AgeGate; maxPlayers: number; settings: TableSettings; viewer: Viewer | null }

/**
 * Sits somebody down at a table that waits: the write that `POST …/join` does, which is also the one a search does to sit a visitor at a lobby it found. The age of the table, the criteria of a public table (the rank and the language its host asked, the gap
 * from the tier a ranked table opened at), who may sit at a ranked table (members only) and the seats it has are checked on the table as it is when the write lands. A player who sits already is never asked again. `added` says whether this call took a seat
 * (renaming oneself in the lobby is not a join).
 */
export async function joinTable(game: PlayableGame, code: string, sitter: Sitter, { gate, maxPlayers, settings, viewer }: JoinChecks): Promise<{ row: GameRow; added: boolean }> {
  const { id, profile, memberId } = sitter
  if (settings.ranked && memberId === null) throw new ApiError("RANKED_MEMBERS_ONLY", 403)
  // Set by the run of the modifier that the write came from: renaming oneself in the lobby is not a join
  const joined = { added: false }
  const row = await updateGame(game, code, (row) => {
    // Before anything else, and on the table as it is when the write lands: the host may have switched an expansion for adults on since the page was drawn
    gate.assertMay(gate.tableAge(row.options))
    joined.added = false
    const existing = row.players.find((j) => j.id === id)
    if (existing) {
      if (row.status !== "lobby") return null
      return { players: row.players.map((j) => (j.id === id ? { id, ...profile } : j)) }
    }
    if (row.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
    const unmet = viewer ? unmetCriteria(settings, viewer, Date.now() - Date.parse(row.created_at ?? "")) : null
    if (unmet) throw new ApiError(UNMET_CODES[unmet], 403)
    if (row.players.length >= effectiveSettings(settings, maxPlayers).seats) throw new ApiError("GAME_FULL", 409)
    joined.added = true
    // A lobby that a ready check emptied has no host: whoever sits down first is it
    return { players: [...row.players, { id, ...profile }], ...(row.players.length === 0 ? { host_id: id } : {}) }
  })
  await recordSeat(game, row.code, sitter, gate)
  if (joined.added) trackAfter("player_joined", id, { game: game.slug, seat: row.players.findIndex((j) => j.id === id), players: row.players.length })
  return { row, added: joined.added }
}

/** What opening a table needs: the age gate of the visitor, the options it opens with, what the host set (kept with the table) and whether it counts for the rank, and how many players the game takes (for the event). */
export type OpenChecks = { gate: AgeGate; options: OptionValues; settings?: TableSettings; ranked?: boolean; maxPlayers: number }

/** Opens a table with the visitor at it: the write that `POST /api/<slug>/games` does, which is also the one a search does when it finds no lobby to sit at. A table that asks for an age is opened only by somebody who has it. */
export async function openTable(game: PlayableGame, sitter: Sitter, { gate, options, settings, ranked, maxPlayers }: OpenChecks): Promise<GameRow> {
  gate.assertMay(gate.tableAge(options))
  const row = await createGame(game, { id: sitter.id, ...sitter.profile }, options, { settings, ranked })
  await recordSeat(game, row.code, sitter, gate)
  trackAfter("game_created", sitter.id, { game: game.slug, options: row.options, max_players: maxPlayers, locale: await getLocale() })
  return row
}

/** Whether a table is full: everybody it was set for sits at it. */
export const isFull = (row: Pick<GameRow, "players">, settings: TableSettings, maxPlayers: number): boolean =>
  seatedPlayers(row.players).length >= effectiveSettings(settings, maxPlayers).seats

/** Who asks a table to begin: the account that acts and its seat, and whether it is the host's start (the host only, and a ranked table waits to be full) or the start of a table that has just filled, which is nobody's click. */
export type BeginRequest = { ageRules: AgeRulesSource; actor: Actor; self: string | null; byHost: boolean }

/**
 * Sets the game up with the people seated now and puts the table in its ready check (`starting`): the host's `POST …/start`, and what a table that has filled does by itself. A table whose last ready check ran out of time is back in the lobby before this
 * looks at it. It is refused when the table is not in the lobby (`GAME_IN_PROGRESS`), has fewer players than the game needs (`NOT_ENOUGH_PLAYERS`), has somebody seated who does not meet the age it asks (`AGE_TABLE_NOT_ALLOWED`) or who is in a game somewhere
 * else (`PLAYER_BUSY`, PLT-120: who is, is asked of the database before the write, with the table as it was read, and a table whose seats changed in between is not started on that look: `CONFLICT`). A look that cannot be had lets the table start.
 */
export async function beginTable(game: PlayableGame, code: string, { ageRules, actor, self, byHost }: BeginRequest): Promise<GameRow> {
  const { minPlayers, maxPlayers } = await loadSettings(game)
  const settled = await settleReadyCheck(game, await readGame(game, code))
  const data = await loadSetupData(game, settled.options)
  // Who sits at a table that asks for an age is looked up before the write, with the table as it was read: the modifier below cannot wait for the database. A table that asks for no age looks nobody up
  const gate = await ageGateFor(ageRules, game, actor)
  const seats = gate.tableAge(settled.options) !== null ? await gate.seatsOf(settled, self) : null
  const busy = settled.status === "lobby" ? await busySeats(game, code) : []
  // A ranked table begins when it is full and not before: its host has no say in it
  const kept = byHost ? await readTableSettingsOf(game.slug, settled.code) : null
  return updateGame(game, code, (row) => {
    if (byHost && row.host_id !== self) throw new ApiError("HOST_ONLY", 403)
    if (row.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
    if (row.players.length < minPlayers) throw new ApiError("NOT_ENOUGH_PLAYERS")
    if (kept?.ranked && !isFull(row, kept, maxPlayers)) throw new ApiError("RANKED_TABLE_NOT_FULL", 409)
    gate.assertSeats(row, gate.tableAge(row.options), seats)
    if (!sameSeats(row.players, settled.players)) throw new ApiError("CONFLICT", 409)
    if (busy.length) throw new ApiError("PLAYER_BUSY", 409)
    return startingPatch(newGame(game, row, data), Date.now())
  })
}

/**
 * A table that has just filled begins by itself (`beginTable`, with nobody's click): the join that took the last seat asks it. The seat is taken whatever happens here, so a table that cannot begin (somebody at it is in a game: `PLAYER_BUSY`, the age of
 * somebody seated, a seat that changed in between) stays a full lobby that its host starts when it can, and the call answers with the table as it was. Nothing happens for a table that is not in the lobby, that is not full or that has fewer than two players.
 * Only one request begins a table: the writes of a table are one after the other, and the one that finds it already `starting` changes nothing.
 */
export async function startWhenFull(game: PlayableGame, row: GameRow, who: { id: string; actor: Actor }, { ageRules, settings }: { ageRules: AgeRulesSource; settings: TableSettings }): Promise<GameRow> {
  try {
    const { minPlayers, maxPlayers } = await loadSettings(game)
    if (row.status !== "lobby" || seatedPlayers(row.players).length < Math.max(minPlayers, 2) || !isFull(row, settings, maxPlayers)) return row
    return await beginTable(game, row.code, { ageRules, actor: who.actor, self: who.id, byHost: false })
  } catch (error) {
    if (!(error instanceof ApiError)) console.error("A table that filled could not begin", { game: game.slug }, error instanceof Error ? error.message : error)
    return row
  }
}

/**
 * Takes a player out of a lobby they sit at, the way leaving one does (`leavePatch`: another host if they were it), and deletes the table when nobody is left (`deleteEmptyTable`). Nothing for a table that is not a lobby, that is gone or that they do not sit at.
 * Says whether they were unseated.
 */
export async function leaveLobby(game: GameRef, code: string, seat: string): Promise<boolean> {
  const outcome = { changed: false }
  try {
    const row = await updateGame(game, code, (row) => {
      outcome.changed = false
      const patch = row.status === "lobby" ? leavePatch(row, seat) : null
      outcome.changed = patch !== null
      return patch
    })
    if (outcome.changed) await deleteEmptyTable(game, row)
    return outcome.changed
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return false
    throw error
  }
}

/**
 * When a game begins, the people who play it leave every other lobby where they sit: a player in a game cannot begin another, so a lobby that holds them could not start while they play, and staying in it would only block the others there. A member
 * leaves their lobbies of every game (the account of each seat is `games.member_ids`), a guest the ones of this game (they are known by the cookie of the game alone). A game in progress is never left this way, nor is a table whose ready check is on:
 * it is what the player may be in. Never throws: a lobby that could not be left is logged, and stays until its player leaves it or the nightly clean-up takes it.
 */
export async function leaveOtherLobbies(game: GameRef, row: Pick<GameRow, "code" | "players">): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin().from("games").select("member_ids").eq("game", game.slug).eq("code", row.code).maybeSingle()
    if (error) throw error
    const accounts = ((data as { member_ids?: Record<string, unknown> } | null)?.member_ids ?? {}) as Record<string, unknown>
    const here = (table: { game: string; code: string }) => table.game === game.slug && table.code === row.code
    const members = new Set<string>()
    const guests: string[] = []
    for (const player of seatedPlayers(row.players)) {
      const account = accounts[player.id]
      if (typeof account === "string") members.add(account)
      else guests.push(player.id)
    }
    const lobbies = (
      await Promise.all([
        ...[...members].map((account) => readMemberTables(account).catch(() => [])),
        ...guests.map((seat) => readPlayerTables(game.slug, seat).catch(() => [])),
      ])
    ).flat()
    await Promise.all(lobbies.filter((table) => table.status === "lobby" && !here(table)).map((table) => leaveLobby({ slug: table.game }, table.code, table.seat)))
  } catch (error) {
    console.error("The other lobbies of the players could not be left", { game: game.slug }, error instanceof Error ? error.message : error)
  }
}
