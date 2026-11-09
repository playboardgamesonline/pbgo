import { mostPlayed, playedGameOf, statsFrom, type GameStats, type GameTotals, type PlayedGame } from "@pbgo/accounts"
import type { Rank } from "@pbgo/ui/ranks"
import type { MemberGameRow, MemberGameTotals } from "../server/standings"

// What the pages of a signed-in member say of the games they played (`/me`, `/me/games`, the home's Your games), made of what the database answers (`readMemberGames`, `readMemberTotals`: PLT-13): the games they finished, the latest first,
// their figures, what they played of each game and the rank they have in the ones they rated. Pure, so that it is tested as it is; the hub reads the database and names the games (`apps/web/src/lib/member-games.ts`).

/** A member's rank in a game they rated: the rank their points read as, and how far they are through its division (null at the top, where a rank is a place and not a score). */
export type MemberRank = { slug: string; name: string; rank: Rank; progress: { points: number; needed: number } | null }

export type MemberGames = {
  /** The games to list, the latest first: the ones that are over. */
  games: readonly PlayedGame[]
  /** Their figures, from the totals of every game they finished, not only the ones listed. */
  stats: GameStats
  /** What they played of each game, the most played first. */
  perGame: readonly GameTotals[]
  /** Their rank in each game they rated, the highest first. */
  ranks: readonly MemberRank[]
}

/** A member who has played nothing. */
export const NO_GAMES: MemberGames = { games: [], stats: statsFrom([]), perGame: [], ranks: [] }

/**
 * The games of a member as the pages draw them: `rows` are their latest finished games, `totals` what they have done in each game (`player_stats` and `ratings`, every game they finished), `nameOf` names a game by its slug.
 * A game they rated and never finished (no totals) has a rank and no row of its own, and a game with no rated game has no rank.
 */
export function memberGamesOf(rows: readonly MemberGameRow[], totals: readonly MemberGameTotals[], nameOf: (slug: string) => string): MemberGames {
  const played = totals.filter((row) => row.gamesPlayed > 0).map((row) => ({ slug: row.game, name: nameOf(row.game), played: row.gamesPlayed, wins: row.wins }))
  const ranked = totals.flatMap((row) => (row.rank && row.points !== null ? [{ points: row.points, slug: row.game, name: nameOf(row.game), rank: row.rank, progress: row.rankProgress }] : []))
  return {
    games: rows.map((row) => playedGameOf(row, nameOf(row.game))),
    stats: statsFrom(played),
    perGame: played.sort(mostPlayed),
    ranks: ranked.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)).map(({ slug, name, rank, progress }) => ({ slug, name, rank, progress })),
  }
}
