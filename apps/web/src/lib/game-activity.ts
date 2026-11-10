import "server-only"
import type { PlatformLanguage } from "@pbgo/accounts/language"
import { expansionsOf, pickLocalized, pictureRatio, pictureUrl } from "@pbgo/catalog"
import { getCatalog } from "@pbgo/catalog/server"
import type { Locale } from "@pbgo/core/lib/i18n"
import { getLocale } from "@pbgo/core/lib/locale-server"
import type { TableSettings } from "@pbgo/core/lib/table-settings"
import { ApiError } from "@pbgo/core/server/api"
import { findPlayerGame, readGame, type GameRow } from "@pbgo/core/server/games"
import { getPlayerId } from "@pbgo/core/server/player"
import { readBoard, readHistory, readPlayerStanding } from "@pbgo/core/server/standings"
import { seatedPlayers } from "@pbgo/core/server/table-rules"
import { readTableSettingsOf } from "@pbgo/core/server/table-settings"
import { readPublicTables, type MemberTable, type PublicTable } from "@pbgo/core/server/tables"
import type { Outcome } from "@pbgo/ui/results"
import type { Rank, Tier } from "@pbgo/ui/ranks"
import type { PlayerRecord } from "@pbgo/ui/tables"

// What is going on around a game, for its page on the hub: its tables (the ones that wait for players and the ones being played), the table the visitor sits at, its best players, what the visitor has done in it, its tournaments and the expansions that a table may be played with. Every table counts for the leaderboard and none can be looked on at, so the tables have neither as a setting. The page
// reads them here and nowhere else. The best players, what the visitor has done and their games are read from the games that were recorded (PLT-13, `game_results`, `game_participants`, `ratings`, `player_stats`: `@pbgo/core/server/standings`), and
// come back empty, with the page's empty state, where nothing is recorded or the database cannot be read. The tables, the tournaments and the achievements do not exist yet, so each comes back empty too, but the expansions of a game: they are `expansion`
// documents of the platform's Sanity project, which the catalog reads (`getExpansions`). The types are the shape of the rows of the platform schema of PLT-13 (`platform.tables` and `table_players` for the tables; the design is in the Linear documents
// "PLT-13 final schema proposal" and "PLT-13 SQL"), written without Supabase, so that the day the schema is there only the bodies of these functions change and the page does not. The tournaments are PLT-31's and have no row in that
// schema yet, and neither have achievements, whose shape here is the page's guess.
// The tables are the exception since PLT-106 (the platform is the door of the games): a table is a row of `public.games`, which the game's routes create, fill and start, so `getViewerTable` and `getTable` read
// it (`tableOfRow`) and the rest of the page does not know. The visitor is the per-game player cookie (`<slug>_player`) until the accounts of PLT-13 own a seat. What the host sets apart from the engine's options (who may join,
// the speed, the seats) is `games.settings` (PLT-21, migration 0014), read with the table (`readTableSettingsOf`), and the public tables a game lists (`getTables`, `getPublicTables`) are the lobbies its hosts made public
// (`public_tables`); a project where the migration is not applied yet has no settings and lists none.

/** What a table of the page is doing: it waits for players (`lobby`) or it is being played (`playing`). A table that is over or given up is a result (`game_results`), not a table of the page. */
export type TableStatus = "lobby" | "playing"

/** Who may find a table (`tables.visibility`): a `public` one is listed on the game's page, a `private` one is reached by its link. */
export type TableVisibility = "private" | "public"

/** The pace of a table (`tables.turn_timer`): `slow`, `normal` and `fast` have a clock on every turn, from the longest to the shortest, `none` has none, `async` leaves a day or more to play. */
export type TurnTimer = "none" | "slow" | "normal" | "fast" | "async"

/** One person seated at a table: a row of `table_players` that has not left (`left_at is null`), with the picture of their profile. */
export type TablePlayer = {
  /** `players.id` */
  playerId: string
  /** `table_players.seat`, 0 to 9: the seat they took. */
  seat: number
  /** `table_players.display_name`, the name they sat down with: "Alex#0042" for an account, a plain name for a guest, null once they have deleted their account. */
  name: string | null
  /** `profiles.avatar_url`, the picture their provider gives. Null for a guest and for an account whose provider gives none. */
  avatarUrl: string | null
  /** Their rank in this game and the games they played and won, which their card says. The rank is read on the server from their rank points (`ratings.points`) and arrives as a tier and a division: the hidden rating the points come from is never here. Null for a guest, and for an account that has not played the game ranked. */
  record: PlayerRecord | null
}

/** A table of a game that waits for players or is being played: a row of `platform.tables` with the people seated at it. The page lists the public ones (`getTables`); the visitor's own, public or private, is `getViewerTable`'s. */
export type GameTable = {
  /** `tables.id` */
  id: string
  /** `tables.code`: the join code in the table's address, `/<slug>/game/<code>`. */
  code: string
  status: TableStatus
  visibility: TableVisibility
  /** The least rank a player must have in the game to sit at it (`games.settings`), none when it asks for nothing. Only a public table asks: a private one keeps what its host chose, for the day they make it public. */
  minRank?: Tier | null
  /** The language its players are asked to speak, by the code the lobby offers (`LANGUAGE_OPTIONS`), none when it asks for nothing. */
  language?: PlatformLanguage | null
  /** `tables.host_player_id`: who opened it; null once they have deleted their account. */
  hostId: string | null
  /** `tables.seats_max`: how many seats it has, 1 to 10. */
  seatsMax: number
  /** The people seated at it, in no particular order. */
  players: TablePlayer[]
  /** `tables.turn_timer`: the speed of the game. */
  turnTimer: TurnTimer
  /** The expansions the table is played with, by `Expansion.id` (the game's own settings, which the schema keeps in one column of the table): none for the base game. The page's guess. */
  expansions: string[]
  /** `tables.created_at`, an ISO date. */
  createdAt: string
  /** `tables.started_at`: when it began to be played, null while it waits. A row of `games` does not date its start, so a table read from it says null and its age counts from `createdAt`. */
  startedAt: string | null
  /** The version of the row the page read (`games.version`): the page of a table that waits asks again when it moves on (`TableSync`). Only the tables read from `games` have one; PLT-13's tables have Realtime of their own. */
  version?: number
  /** The keys of the options the table holds (`games.options`, which are the options of the game's engine): the choices of a lobby's settings that the current backend can keep are those whose id is one of them (`engineOptionsOf`). */
  optionKeys?: string[]
}

/** The table the visitor sits at: a table of the page, and whether they opened it, since only the one who did sets it. */
export type ViewerTable = GameTable & { viewerIsHost: boolean }

/**
 * An expansion of a game that a table may be played with: what it is called and its pictures, its cover (the card's picture) and the front of its box (the card's when it has no cover), each with its shape, its width over its height, as its source has it (`pictureRatio`), so that the card
 * can take that shape; its description, in the visitor's language when the Studio has it in that one, else in another; what it changes about the game, each figure only when it differs from the base game's, and null when it does not (the
 * players it takes, the minutes, the weight on BoardGameGeek's scale, the minimum age); and the categories it brings that the base game does not have.
 * They are the `expansion` documents of the platform's Sanity project whose base game is the game: `@pbgo/catalog` reads them apart, since they have no page of their own.
 */
export type Expansion = {
  id: string
  name: string
  description: { text: string; language: Locale } | null
  players: { min: number; max: number | null } | null
  duration: number | null
  complexity: number | null
  age: number | null
  categories: string[]
  coverUrl: string | null
  coverRatio: number | null
  boxUrl: string | null
  boxRatio: number | null
  /** The visitor cannot choose it, for its age, and why (`lockedExpansions`): the card says it and does not let its box be ticked. Not part of the expansion: the page adds it for the visitor it draws. */
  locked?: { reason: string; kind: string }
}

/** One player's standing in a game: their row of `platform.ratings` as the browser may have it, a rank, with the nickname and the picture of their `profiles` row. Only an account has one: a guest is never ranked. */
export type Standing = {
  /** `players.id` */
  playerId: string
  /** `profiles.nickname` and `profiles.tag` ("Alex" and 42: Alex#0042). */
  nickname: string
  tag: number
  avatarUrl: string | null
  /** Their rank: read from their rank points, which they earn by playing (`ratings.points`). The hidden rating the points come from is never sent. */
  rank: Rank
  /** `ratings.wins` and `ratings.games_played`. */
  wins: number
  gamesPlayed: number
  /** Their place on the board, 1 for the best, in the order of their rank points. Null while they have played fewer than `LEADERBOARD_MIN_GAMES` ranked games: the board leaves a player out until then (`ratings_board_idx`). */
  place: number | null
}

/** The leaderboard of a game: its best players, and the signed-in visitor's own standing wherever it is. */
export type GameStandings = {
  /** The best players, best first, at most `LEADERBOARD_SIZE`. */
  top: Standing[]
  /** The visitor's own standing: null for a visitor who is not signed in or who has never played the game ranked. It may be one of `top` as well. */
  viewer: Standing | null
}

/** How many players the leaderboard holds on the page: the board scrolls through them. */
export const LEADERBOARD_SIZE = 100

/** How many ranked games a player needs before they are on the board. */
export const LEADERBOARD_MIN_GAMES = 5

/** An achievement a visitor earned in a game. PLT-13's schema has no table for them: this is the shape the page needs, a name, what it was for and when, and it stays empty until there is somewhere to read them. */
export type Achievement = { id: string; name: string; description: string; earnedAt: string }

/**
 * How far a player is from the next division of their rank, in the points the platform shows for it: `points` earned toward the `needed` that make the division. Rank points, which the server derives with the rank and sends in its place: the hidden
 * rating itself is never sent. `points` goes from 0 to `needed - 1`: at `needed` a player moves up a division, so 99 of 100 is the most the hub ever shows.
 */
export type RankProgress = { points: number; needed: number }

/** What a signed-in visitor has done in a game: the figures of their `game_participants` rows (the tables they finished), their rank and their place on the board. */
export type PlayerStats = {
  /** How many games they finished, ranked or not: the rows of `game_participants`. */
  gamesPlayed: number
  /** How long they spent at those games, in seconds: the sum of what each lasted (`tables.started_at` to `game_results.finished_at`). */
  secondsPlayed: number
  /** How many of them they won (`outcome` is `win` or `coop_win`). */
  wins: number
  /** Their rank in the game, as `Standing.rank`: null while they have none (no ranked game yet). */
  rank: Rank | null
  /** How far they are from the next rank: null where no points apply, with no rank yet and at the top, where a rank is a place and not a score. */
  rankProgress: RankProgress | null
  /** Their place on the board, as `Standing.place`: null while they are not on it. */
  place: number | null
  /** How many players are on the board (the rows of `ratings` of this game with `LEADERBOARD_MIN_GAMES` games), which their place is one of. */
  rankedPlayers: number
  achievements: Achievement[]
  /** How many achievements the game has in all, the earned ones included: what the progress of their achievements is counted against. The page's guess, like `Achievement`: nothing lists a game's achievements yet, so it is 0. */
  achievementsTotal: number
}

/** One game a visitor finished: a row of their `game_participants` with its `game_results`. What it did to their hidden rating is not here, only what it did to their rank points. */
export type HistoryEntry = {
  /** `game_results.table_id` */
  tableId: string
  /** `game_results.finished_at`, an ISO date. */
  finishedAt: string
  /** `game_participants.outcome`. */
  outcome: Outcome
  /** `game_participants.rank`, their place at the end of the game: 1 is first, ties share a place. Null where no ranking applies (a game played together). */
  place: number | null
  /** `game_results.player_count` */
  playerCount: number
  /** The rank points the game gave them (+32) or took (-11), in the unit of the figure under their rank (100 to a division): what the game added to their points (`rating_changes`, whole numbers: a win over a stronger player gives more, a loss to a weaker one takes more); the hidden rating is never here. Null where no points apply (a game played together, a game with no ranking). */
  points: number | null
  /** How long the game lasted, in seconds: `game_results.finished_at` less the `started_at` of its table. Null when it is not known. */
  durationSeconds: number | null
  /** `tables.turn_timer` of its table: the speed it was played at. */
  turnTimer: TurnTimer
  /** `game_participants.score` */
  score: number | null
  /** The expansions the game was played with, by `Expansion.id`: none for the base game. The page's guess, like `GameTable.expansions`. */
  expansions: string[]
  /** The experience the game gave them (XP), null when it gave none. The page's guess: the schema has no such column. */
  xp: number | null
  /** The others at the table: the name they sat down with (`game_participants.display_name`; null: a player who has since deleted their account) and the picture of their profile. */
  opponents: { name: string | null; avatarUrl: string | null }[]
}

/** How many games the history holds on the page, the latest first. */
export const HISTORY_SIZE = 10

/** A tournament of a game: when it starts (an ISO date), how many may sign up (`places`) and how many have (`registered`). */
export type GameTournament = { id: string; name: string; status: "upcoming" | "live" | "finished"; startsAt: string; places: number; registered: number }

/**
 * The public tables of the game, the ones a visitor may join: the lobbies whose host made them public, that somebody is at lately, the newest first (`readPublicTables`, PLT-21). A table that is being played is not listed (no game lets anyone
 * look on for now). `seatsMax` is how many seats the game's tables have, which a table set for fewer lowers. A project where migration 0014 is not applied yet lists none.
 */
export async function getTables(slug: string, seatsMax: number): Promise<GameTable[]> {
  return publicTablesOf(await readPublicTables(slug), () => seatsMax)
}

/** The public tables of every game, the newest first, for the Tables tab and the home: `seatsMaxOf` is how many seats a game's tables have (null: the game is not known, and its tables are left out). */
export async function getPublicTables(seatsMaxOf: (slug: string) => number | null, limit?: number): Promise<Array<GameTable & { game: string }>> {
  return publicTablesOf(await readPublicTables(null, limit), seatsMaxOf)
}

/** The lobbies `public_tables` answered, as tables of the page: with nobody seated a lobby is no table (everybody left), and a game that is not known has no seats to draw. */
function publicTablesOf(tables: readonly PublicTable[], seatsMaxOf: (slug: string) => number | null): Array<GameTable & { game: string }> {
  return tables.flatMap((table) => {
    const seatsMax = seatsMaxOf(table.game)
    if (seatsMax === null) return []
    const drawn = tableOfRow(
      { code: table.code, host_id: table.hostId, status: "lobby", players: table.players, options: table.options, version: 0, created_at: table.createdAt, updated_at: table.updatedAt },
      seatsMax,
      table.settings,
    )
    return drawn && drawn.players.length > 0 ? [{ ...drawn, game: table.game }] : []
  })
}

/**
 * A row of `games` as a table of the page, null when it is over (that is a result, not a table). Its people are in the order they sat down, which is their seat. `settings` are what its host set (`games.settings`, PLT-21): a table with none is
 * reached by its link alone, so it is `private`, of the usual speed and of as many seats as the game has, as every table was before.
 */
function tableOfRow(row: Pick<GameRow, "code" | "host_id" | "status" | "players" | "options" | "version" | "created_at" | "updated_at">, seatsMax: number, settings: TableSettings = {}): GameTable | null {
  if (row.status === "over") return null
  const options = row.options ?? {}
  // The people at a table are those who did not leave it (PLT-120): a game in progress keeps the seat of a player who left, and the table does not show them
  const seated = seatedPlayers(row.players)
  return {
    id: row.code,
    code: row.code,
    status: row.status === "lobby" ? "lobby" : "playing",
    visibility: settings.visibility ?? "private",
    minRank: settings.minRank ?? null,
    language: settings.language ?? null,
    hostId: row.host_id,
    // Never fewer seats than people: the game's own limit is enforced by its routes. A host may have set fewer than the game takes
    seatsMax: Math.max(settings.seats === undefined ? seatsMax : Math.min(settings.seats, seatsMax), seated.length),
    players: seated.map((player, seat) => ({ playerId: player.id, seat, name: player.nickname, avatarUrl: player.avatarUrl ?? null, record: null })),
    turnTimer: settings.pace ?? "normal",
    expansions: Object.entries(options).flatMap(([key, value]) => (value === true ? [key] : [])),
    createdAt: row.created_at ?? row.updated_at ?? new Date().toISOString(),
    startedAt: null,
    version: row.version,
    optionKeys: Object.keys(options),
  }
}

/**
 * A table of a member (`readMemberTables`, the home's list of their tables) as the page draws a table, so that it is drawn by the same row as the tables of a game's page. The table is never over, since the member's tables are not;
 * `seatsMax` is how many seats the game's tables have, which only a table that waits is drawn with: one that is played has the seats of the people who play it, and no seat left to sit at.
 */
export function tableOfMember(table: MemberTable, seatsMax: number, settings: TableSettings = {}): GameTable {
  const drawn = tableOfRow(
    { code: table.code, host_id: table.hostId, status: table.status, players: table.players, options: table.options, version: 0, created_at: table.createdAt, updated_at: table.updatedAt },
    table.status === "lobby" ? seatsMax : 0,
    settings,
  )
  if (!drawn) throw new Error(`The table ${table.code} of ${table.game} is over and is not a table of a member`)
  return drawn
}

/**
 * The table the visitor sits at in this game: the one that waits for players (their lobby) or the one being played (their game), the one they sat down at last, or `code` when they sit at that one (the link of a table they were invited to, which they
 * may have joined already). The visitor is the game's player cookie: a table is a row of `games`, found by the player id it holds (`findPlayerGame`; a table idle for hours is not theirs any more). `seatsMax` is how many seats the game's
 * tables have. Null for a visitor who has no cookie yet, who sits at no table, or when the table cannot be read: the page then offers to open one.
 */
export async function getViewerTable(slug: string, seatsMax: number, code: string | null = null): Promise<ViewerTable | null> {
  const playerId = await getPlayerId(slug)
  if (!playerId) return null
  try {
    const invited = code ? await readGame({ slug }, code).catch(() => null) : null
    const row = invited?.players.some((player) => player.id === playerId) ? invited : await findPlayerGame({ slug }, playerId)
    const table = row ? tableOfRow(row, seatsMax, await readTableSettingsOf(slug, row.code)) : null
    return row && table ? { ...table, viewerIsHost: row.host_id === playerId } : null
  } catch (error) {
    console.error(`The table of a visitor of ${slug} could not be read`, error)
    return null
  }
}

/** A table of this game by its code, the link that was shared: a table that waits or is being played, null for a code nobody has, a table that is over or one that cannot be read. */
export async function getTable(slug: string, code: string, seatsMax: number): Promise<GameTable | null> {
  try {
    const row = await readGame({ slug }, code)
    return tableOfRow(row, seatsMax, await readTableSettingsOf(slug, row.code))
  } catch (error) {
    if (!(error instanceof ApiError)) console.error(`The table ${code} of ${slug} could not be read`, error)
    return null
  }
}

/**
 * The leaderboard of the game: the `LEADERBOARD_SIZE` best players, most rank points first (each comes with a rank), and the standing of the signed-in visitor (`viewerId`, as above). A player is on the board from their fifth
 * ranked game (`LEADERBOARD_MIN_GAMES`); nobody is while no game was ranked, which nothing opens yet (PLT-21). The tag of a player is 0 until the nicknames have one (PLT-39).
 */
export async function getStandings(slug: string, viewerId: string | null): Promise<GameStandings> {
  try {
    const [board, viewer] = await Promise.all([readBoard(slug, LEADERBOARD_SIZE), viewerId === null ? null : readPlayerStanding(viewerId, slug)])
    const top: Standing[] = board.map((row) => ({
      playerId: row.userId,
      nickname: row.name ?? "Player",
      tag: 0,
      avatarUrl: row.avatarUrl,
      rank: row.rank,
      wins: row.wins,
      gamesPlayed: row.gamesPlayed,
      place: row.place,
    }))
    // Their own standing, wherever it is: a player who has rated a game has a rank, and a place from the fifth
    const own: Standing | null =
      viewerId !== null && viewer?.rank
        ? { playerId: viewerId, nickname: viewer.name ?? "You", tag: 0, avatarUrl: viewer.avatarUrl, rank: viewer.rank, wins: viewer.ratedWins, gamesPlayed: viewer.ratedGames, place: viewer.place }
        : null
    return { top, viewer: own }
  } catch (error) {
    console.error(`The standings of ${slug} could not be read`, error)
    return { top: [], viewer: null }
  }
}

/** What the signed-in visitor has done in this game, or null when nobody is signed in. A visitor who is signed in and has played nothing, or whose games cannot be read, has done nothing. */
export async function getPlayerStats(slug: string, viewerId: string | null): Promise<PlayerStats | null> {
  if (viewerId === null) return null
  const nothing: PlayerStats = { gamesPlayed: 0, secondsPlayed: 0, wins: 0, rank: null, rankProgress: null, place: null, rankedPlayers: 0, achievements: [], achievementsTotal: 0 }
  try {
    const standing = await readPlayerStanding(viewerId, slug)
    return {
      ...nothing,
      gamesPlayed: standing.gamesPlayed,
      secondsPlayed: standing.secondsPlayed,
      wins: standing.wins,
      rank: standing.rank,
      rankProgress: standing.rankProgress,
      place: standing.place,
      rankedPlayers: standing.poolSize,
    }
  } catch (error) {
    console.error(`The stats of a visitor of ${slug} could not be read`, error)
    return nothing
  }
}

/** The games the signed-in visitor finished in this game, the latest first, at most `HISTORY_SIZE`. A game played together has no place; the speed is the usual one until a table keeps its own (PLT-13). */
export async function getHistory(slug: string, viewerId: string | null): Promise<HistoryEntry[]> {
  if (viewerId === null) return []
  try {
    const rows = await readHistory(viewerId, slug, HISTORY_SIZE)
    return rows.map((row) => ({
      tableId: row.id,
      finishedAt: row.finishedAt,
      outcome: row.outcome,
      place: row.outcome === "coop_win" || row.outcome === "coop_loss" ? null : row.place,
      playerCount: row.playerCount,
      points: row.points,
      durationSeconds: row.durationSeconds,
      turnTimer: "normal",
      score: row.score,
      expansions: Object.entries(row.options).flatMap(([key, value]) => (value === true ? [key] : [])),
      xp: null,
      opponents: row.opponents,
    }))
  } catch (error) {
    console.error(`The games of a visitor of ${slug} could not be read`, error)
    return []
  }
}

/**
 * The expansions of the game that a table may be played with, with their pictures, their description and what they change: the `expansion` documents of the platform's Sanity project that name it as their base game, by name (`@pbgo/catalog`, cached with the rest of the catalog). A game that has none
 * in the Studio has none (`docs/platform-sanity.md`).
 */
export async function getExpansions(slug: string): Promise<Expansion[]> {
  const { entries, expansions } = await getCatalog()
  const locale = await getLocale()
  const base = entries.find((entry) => entry.slug === slug)?.game
  // The Studio fills a figure of an expansion only where it changes the game's: an expansion says what it changes, and the figures that its game already has are not said again
  const round = (weight: number) => Math.round(weight * 10) / 10
  return expansionsOf(expansions, slug).map((expansion) => {
    const min = expansion.playersMin ?? base?.players?.min ?? null
    const max = expansion.playersMax ?? base?.players?.max ?? null
    return {
      id: expansion.slug,
      name: expansion.name,
      description: pickLocalized(expansion.descriptions, locale),
      players: base?.players && min !== null && (min !== base.players.min || max !== base.players.max) ? { min, max } : null,
      duration: expansion.duration !== null && expansion.duration !== (base?.duration ?? null) ? expansion.duration : null,
      complexity: expansion.complexity !== null && round(expansion.complexity) !== (base?.complexity == null ? null : round(base.complexity)) ? expansion.complexity : null,
      age: expansion.age !== null && expansion.age !== (base?.age ?? null) ? expansion.age : null,
      categories: expansion.categories.filter((category) => !base?.categories.includes(category)),
      coverUrl: pictureUrl(expansion, "cover", 480),
      coverRatio: pictureRatio(expansion.pictures.cover),
      boxUrl: pictureUrl(expansion, "boxFront", 320),
      boxRatio: pictureRatio(expansion.pictures.boxFront),
    }
  })
}

/** The tournaments of the game, upcoming, in progress and finished. There are none yet. */
export async function getTournaments(slug: string): Promise<GameTournament[]> {
  void slug
  return []
}
