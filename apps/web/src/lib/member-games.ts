import "server-only"
import { perGame, statsOf, type Account } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { expansionsOf } from "@pbgo/catalog"
import { getCatalog } from "@pbgo/catalog/server"
import { memberGamesOf, NO_GAMES, type MemberGames, type MemberRank } from "@pbgo/core/lib/member-games"
import { readMemberGames, readMemberTotals } from "@pbgo/core/server/standings"
import { DEMO_GAMES } from "./demo-data"

export type { MemberGames, MemberRank }

// What the pages of a signed-in member say of the games they played (`/me`, `/me/games`, and the home's Your games). A member's come from the games that were recorded (PLT-13: `game_results`, `game_participants`, `player_stats`, `ratings`, read by
// `@pbgo/core/server/standings` and put together by `@pbgo/core/lib/member-games`); the development account (`@pbgo/accounts/demo`) has made-up ones, so that the pages can be seen whole where there is no database. A database that cannot be read, or
// that has not got the games yet, answers the same as a member who has played nothing, with the cause in the log: the pages draw their empty states.

// The development account has played a few games, and rates two of them
const DEMO_RANKS: readonly MemberRank[] = [
  { slug: "courtisans", name: "Courtisans", rank: { tier: "Gold", division: 2 }, progress: { points: 36, needed: 100 } },
  { slug: "hanabi", name: "Hanabi", rank: { tier: "Silver", division: 3 }, progress: { points: 71, needed: 100 } },
]

const DEMO: MemberGames = { games: DEMO_GAMES, stats: statsOf(DEMO_GAMES), perGame: perGame(DEMO_GAMES), ranks: DEMO_RANKS }

/**
 * The games of this member, at most `limit` of them listed (`MEMBER_GAMES_MAX` of the reader is the most it answers): what the pages draw, the member's own and, by their account's id, the profile that another member opens. The games are named as the catalog
 * names them, by their slug where the catalog has no entry for it.
 */
export async function memberGames(account: Pick<Account, "id">, limit: number): Promise<MemberGames> {
  if (isDemoAccount(account)) return DEMO
  try {
    const [rows, totals, catalog] = await Promise.all([readMemberGames(account.id, limit), readMemberTotals(account.id), getCatalog()])
    return memberGamesOf(
      rows,
      totals,
      (slug) => catalog.entries.find((entry) => entry.slug === slug)?.game.name ?? slug,
      // The expansions are the options that were switched on and that the game has an expansion of the same name for, as the page of a game says them
      (slug, options) => expansionsOf(catalog.expansions, slug).flatMap((expansion) => (options[expansion.slug] === true ? [expansion.name] : [])),
    )
  } catch (error) {
    console.error("The games of a member could not be read", error)
    return NO_GAMES
  }
}
