// What the games a visitor played say of them: the figures of their profile. Pure, so that the pages that draw them, whether the games come from the database
// (a member's, PLT-13) or from the made-up ones of the development account, and the tests all read them the same way.

import type { Handle } from "./profile"

/** What the card of an opponent says: their rank in the game (a tier and a division, none at the top) and how many games of it they won. A guest, and an account that rated nothing in the game, have none. */
export type OpponentRecord = { rank: { tier: string; division?: number }; gamesPlayed: number; wins: number }

/** A game a visitor played, or is playing. */
export type PlayedGame = {
  id: string
  /** The slug of the game: its page on the hub is `/game/<slug>`, its picture comes from the catalog's route. */
  slug: string
  name: string
  /** When it started or, for a game that was recorded, when it ended (an ISO date): a result keeps the end. */
  playedAt: string
  /** The code of the table, for a game in progress. A game that is over has none: its result is kept without the table, which goes. */
  table?: string
  /** The others at the table. An opponent whose account is still there has a handle, which is where their profile is (`profilePath`): a guest has none, and neither has an account that was deleted. */
  opponents: readonly { nickname: string; avatarUrl?: string | null; handle?: Handle | null; record?: OpponentRecord | null }[]
  state: "in-progress" | "finished"
  /** How it ended for the visitor, once it has. */
  result?: "won" | "lost" | "draw"
  /** Their rank at the end, among `opponents.length + 1` players. */
  rank?: number
  /** The rank points the game gave them (+) or took (−): absent where none applied, a game that was not rated or that was played together. */
  points?: number
  /** Their score, for a game that counts points (the total the engine gives them): absent for one that does not. */
  score?: number
  /** The table was played for the rank (a game that counted for it) and not as a normal one. */
  ranked?: boolean
  /** How many players sat at the table, the visitor included. */
  playerCount?: number
  /** How long the game lasted, in seconds: absent where the start was not told. */
  durationSeconds?: number
  /** The speed the table was set to: `none`, `slow`, `normal`, `fast` or `async` (the words are the platform's, `PACES` of `@pbgo/ui/tables`). */
  pace?: string
  /** The expansions it was played with, by name. */
  expansions?: readonly string[]
}

/** The games that are over. */
const finishedOf = (games: readonly PlayedGame[]): PlayedGame[] => games.filter((game) => game.state === "finished")

/** What a visitor has played of one game: how many games of it are over and how many they won. */
export type GameTotals = { slug: string; name: string; played: number; wins: number }

/** The order the games of a visitor are listed in: the most played first, then by name. */
export const mostPlayed = (a: GameTotals, b: GameTotals): number => b.played - a.played || a.name.localeCompare(b.name)

/** The figures of a profile. */
export type GameStats = { played: number; wins: number; winRate: number | null; favourite: string | null }

/**
 * The figures of the profile, from what was played in each game: how many games were played, how many won, the share of wins in whole percent, and the game played the most (the first by name when two are tied). `null` where there is nothing to say.
 * A member's come from the totals the database keeps (`player_stats`), which hold every game they finished, where the games they can list are the latest only.
 */
export function statsFrom(rows: readonly GameTotals[]): GameStats {
  const played = rows.reduce((sum, row) => sum + row.played, 0)
  const wins = rows.reduce((sum, row) => sum + row.wins, 0)
  const favourite = rows.filter((row) => row.played > 0).sort(mostPlayed)[0]?.name ?? null
  return { played, wins, winRate: played > 0 ? Math.round((wins / played) * 100) : null, favourite }
}

/** The figures of the profile, from the games that are over (a game in progress counts for nothing yet). */
export const statsOf = (games: readonly PlayedGame[]): GameStats => statsFrom(perGame(games))

/** The games a visitor has finished, one row per game: how many, how many won, in the order of `mostPlayed`. */
export function perGame(games: readonly PlayedGame[]): GameTotals[] {
  const rows = new Map<string, GameTotals>()
  for (const game of finishedOf(games)) {
    const row = rows.get(game.slug) ?? { slug: game.slug, name: game.name, played: 0, wins: 0 }
    row.played += 1
    if (game.result === "won") row.wins += 1
    rows.set(game.slug, row)
  }
  return [...rows.values()].sort(mostPlayed)
}

/** A game a member finished, as the database tells it (`MemberGameRow` of `@pbgo/core/server/standings`, which this is the part of that the pages list: `@pbgo/accounts` does not import core). */
export type FinishedGame = {
  id: string
  /** The slug of the game. */
  game: string
  /** When it ended (an ISO date). */
  finishedAt: string
  outcome: "win" | "loss" | "draw" | "coop_win" | "coop_loss" | "abandoned"
  /** Where they came, null where the engine ranked nobody. */
  place: number | null
  /** The rank points the game gave them (+) or took (−), null where none applied. */
  points: number | null
  /** Their total, null where the engine gives none. */
  score: number | null
  /** The table was played for the rank. */
  ranked: boolean
  playerCount: number
  /** How long it lasted, in seconds, null where the start was not told. */
  durationSeconds: number | null
  pace: string
  /** The others at the table, by seat: a seat whose account is gone has no name. The name and the picture are the account's own while it is there, with its handle, else what the seat had. `record` is what their card says of them in the game. */
  opponents: readonly { name: string | null; avatarUrl: string | null; handle?: Handle | null; record?: OpponentRecord | null }[]
}

/** What an opponent whose account is gone is called. */
const FORMER_PLAYER = "Player"

/**
 * A game that was recorded as a row of the visitor's games. It won when it was won (alone or together), drew when it drew, and was lost in every other way: a lost game, a game given up. A game played together has no place, since
 * the table wins or loses as one. `expansions` are the names of the ones it was played with.
 */
export function playedGameOf(game: FinishedGame, name: string, expansions: readonly string[] = []): PlayedGame {
  const together = game.outcome === "coop_win" || game.outcome === "coop_loss"
  return {
    id: game.id,
    slug: game.game,
    name,
    playedAt: game.finishedAt,
    opponents: game.opponents.map((opponent) => ({
      nickname: opponent.name ?? FORMER_PLAYER,
      avatarUrl: opponent.avatarUrl,
      ...(opponent.handle ? { handle: opponent.handle } : {}),
      ...(opponent.record ? { record: opponent.record } : {}),
    })),
    state: "finished",
    result: game.outcome === "win" || game.outcome === "coop_win" ? "won" : game.outcome === "draw" ? "draw" : "lost",
    ...(together || game.place === null ? {} : { rank: game.place }),
    ...(game.points === null ? {} : { points: game.points }),
    ...(game.score === null ? {} : { score: game.score }),
    ranked: game.ranked,
    playerCount: game.playerCount,
    ...(game.durationSeconds === null ? {} : { durationSeconds: game.durationSeconds }),
    pace: game.pace,
    ...(expansions.length > 0 ? { expansions } : {}),
  }
}

const ORDINALS = new Intl.PluralRules("en", { type: "ordinal" })

/** A rank in words: 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
export function ordinal(rank: number): string {
  const rule = ORDINALS.select(rank)
  return `${rank}${rule === "one" ? "st" : rule === "two" ? "nd" : rule === "few" ? "rd" : "th"}`
}
