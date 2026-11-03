import "server-only"
import { expansionsOf, pictureRatio, pictureUrl } from "@pbgo/catalog"
import { getCatalog } from "@pbgo/catalog/server"
import type { Outcome } from "@pbgo/ui/results"
import type { Rank } from "@pbgo/ui/ranks"
import type { PlayerRecord } from "@pbgo/ui/tables"

// What is going on around a game, for its page on the hub: its tables (the ones that wait for players and the ones being played), the table the visitor sits at, its best players, what the visitor has done in it, its tournaments and the expansions that a table may be played with. Every table counts for the leaderboard and none can be looked on at, so the tables have neither as a setting. The page
// reads them here and nowhere else. None of them exists yet, so each comes back empty and the page draws an empty state for it, but the expansions of a game: they are `expansion` documents of the platform's Sanity project, which the catalog reads (`getExpansions`). The types are already the shape the data will have: they are the rows of the platform schema of PLT-13
// (`platform.tables` and `table_players` for the tables, `ratings` and `profiles` for the standings, `game_participants`, `game_results` and `rating_changes` for what a visitor has done; the design is in the Linear documents
// "PLT-13 final schema proposal" and "PLT-13 SQL"), written without Supabase, so that the day the schema is there only the bodies of these functions change and the page does not. The tournaments are PLT-31's and have no row in that
// schema yet, and neither have achievements, whose shape here is the page's guess.

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
  /** Their rank in this game and the games they played and won, which their card says. The rank is derived on the server from their hidden rating (`platform.ratings`) and arrives as a tier and a division: the rating is never here. Null for a guest, and for an account that has not played the game ranked. */
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
  /** `tables.started_at`: when it began to be played, null while it waits. */
  startedAt: string | null
}

/** The table the visitor sits at: a table of the page, and whether they opened it, since only the one who did sets it. */
export type ViewerTable = GameTable & { viewerIsHost: boolean }

/**
 * An expansion of a game that a table may be played with: what it is called and its pictures, its cover (the tile's picture) and the front of its box (the tile's when it has no cover), each with its shape, its width over its height, as its source has it (`pictureRatio`), so that the tile
 * can take that shape. They are the `expansion` documents of the platform's Sanity project whose base game is the game: `@pbgo/catalog` reads them apart, since they have no page of their own.
 */
export type Expansion = { id: string; name: string; coverUrl: string | null; coverRatio: number | null; boxUrl: string | null; boxRatio: number | null }

/** One player's standing in a game: their row of `platform.ratings` as the browser may have it, a rank, with the nickname and the picture of their `profiles` row. Only an account has one: a guest is never ranked. */
export type Standing = {
  /** `players.id` */
  playerId: string
  /** `profiles.nickname` and `profiles.tag` ("Alex" and 42: Alex#0042). */
  nickname: string
  tag: number
  avatarUrl: string | null
  /** Their rank: derived on the server from the hidden rating (`ratings.rating`, an Elo) and from their position among the game's players. The rating orders the board and is never sent. */
  rank: Rank
  /** `ratings.wins` and `ratings.games_played`. */
  wins: number
  gamesPlayed: number
  /** Their place on the board, 1 for the best, in the order of the hidden rating. Null while they have played fewer than `LEADERBOARD_MIN_GAMES` ranked games: the board leaves a player out until then (`ratings_board_idx`). */
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
  /** Their place on the board, as `Standing.place`: null while they are not on it. */
  place: number | null
  /** How many players are on the board (the rows of `ratings` of this game with `LEADERBOARD_MIN_GAMES` games), which their place is one of. */
  rankedPlayers: number
  achievements: Achievement[]
}

/** One game a visitor finished: a row of their `game_participants` with its `game_results`. What it did to their hidden rating is not here, and no rank change is drawn. */
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
 * The public tables of the game, the ones a visitor may join or look at: first the tables that wait for players, then the ones being played, each group with the newest first (`created_at` desc for the first, `started_at` desc for
 * the second). The page draws them in this order. Nothing lists them yet: a table is reached by its link.
 */
export async function getTables(slug: string): Promise<GameTable[]> {
  void slug
  return []
}

/**
 * The table the signed-in visitor sits at in this game: the one that waits for players (their lobby) or the one being played (their game), public or private. `viewerId` is the id of their account, the one Supabase Auth gives
 * (`players.user_id`); null when nobody is signed in. Nobody sits at a table that the platform keeps yet.
 */
export async function getViewerTable(slug: string, viewerId: string | null): Promise<ViewerTable | null> {
  void slug
  void viewerId
  return null
}

/**
 * The leaderboard of the game: the `LEADERBOARD_SIZE` best players, in the order of a rating that stays on the server (each comes with a rank), and the standing of the signed-in visitor (`viewerId`, as above). Nobody is ranked yet: ranks come with the accounts of PLT-13's second phase.
 */
export async function getStandings(slug: string, viewerId: string | null): Promise<GameStandings> {
  void slug
  void viewerId
  return { top: [], viewer: null }
}

/** What the signed-in visitor has done in this game, or null when nobody is signed in. Nothing is recorded yet, so a visitor who is signed in has done nothing. */
export async function getPlayerStats(slug: string, viewerId: string | null): Promise<PlayerStats | null> {
  void slug
  return viewerId === null ? null : { gamesPlayed: 0, secondsPlayed: 0, wins: 0, rank: null, place: null, rankedPlayers: 0, achievements: [] }
}

/** The games the signed-in visitor finished in this game, the latest first, at most `HISTORY_SIZE`. There are none yet. */
export async function getHistory(slug: string, viewerId: string | null): Promise<HistoryEntry[]> {
  void slug
  void viewerId
  return []
}

/**
 * The expansions of the game that a table may be played with, with their pictures: the `expansion` documents of the platform's Sanity project that name it as their base game, by name (`@pbgo/catalog`, cached with the rest of the catalog). A game that has none
 * in the Studio has none (`docs/platform-sanity.md`).
 */
export async function getExpansions(slug: string): Promise<Expansion[]> {
  const { expansions } = await getCatalog()
  return expansionsOf(expansions, slug).map((expansion) => ({
    id: expansion.slug,
    name: expansion.name,
    coverUrl: pictureUrl(expansion, "cover", 480),
    coverRatio: pictureRatio(expansion.pictures.cover),
    boxUrl: pictureUrl(expansion, "boxFront", 320),
    boxRatio: pictureRatio(expansion.pictures.boxFront),
  }))
}

/** The tournaments of the game, upcoming, in progress and finished. There are none yet. */
export async function getTournaments(slug: string): Promise<GameTournament[]> {
  void slug
  return []
}
