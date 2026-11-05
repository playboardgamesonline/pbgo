import "server-only"
import { expansionsOf, pickLocalized, pictureRatio, pictureUrl } from "@pbgo/catalog"
import { getCatalog } from "@pbgo/catalog/server"
import type { Locale } from "@pbgo/core/lib/i18n"
import { getLocale } from "@pbgo/core/lib/locale-server"
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
}

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
  return viewerId === null ? null : { gamesPlayed: 0, secondsPlayed: 0, wins: 0, rank: null, rankProgress: null, place: null, rankedPlayers: 0, achievements: [], achievementsTotal: 0 }
}

/**
 * How long a visitor who looks for a table of this game waits for one, in seconds, as the platform estimates it from the tables it made up lately: the figure that the head of the game's page calls the queue time. Nothing is estimated yet
 * (the matchmaking is PLT-13's, and the queue the head puts a visitor in is in their browser), so it is null and the head leaves the figure out, as it leaves out any figure that cannot be counted.
 */
export async function getQueueEstimate(slug: string): Promise<number | null> {
  void slug
  return null
}

/** The games the signed-in visitor finished in this game, the latest first, at most `HISTORY_SIZE`. There are none yet. */
export async function getHistory(slug: string, viewerId: string | null): Promise<HistoryEntry[]> {
  void slug
  void viewerId
  return []
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
