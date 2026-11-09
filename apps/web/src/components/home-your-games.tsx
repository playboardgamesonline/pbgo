import Link from "next/link"
import type { Account } from "@pbgo/accounts"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { RankBadge } from "@pbgo/ui/platform/rank-badge"
import { Section } from "@pbgo/ui/platform/section"
import { recordOf } from "@pbgo/ui/results"
import { GameRecord, GameThumb } from "@/components/game-record"
import { memberGames } from "@/lib/member-games"

// The member's history and stats, and their rank on each game, on the signed-in home (PLT-13): two blocks side by side, one above the other on a phone. They are the games that were recorded (`memberGames`), the last three with the member's
// record over all of them on the left and the rank they have in each game they rated on the right; a block with nothing to list keeps its empty state, so that the shape of the home is there to see. A server component.

/** How many of the latest games the home lists: the rest are the member's games (`/me/games`). */
const RECENT_GAMES = 3

export async function HomeYourGames({ account }: { account: Account }) {
  const { games, stats, ranks } = await memberGames(account, RECENT_GAMES)
  const recent = games.filter((game) => game.state === "finished").slice(0, RECENT_GAMES)

  return (
    <Section aria-labelledby="home-your-games">
      <h2 id="home-your-games" className="sr-only">
        Your games
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {recent.length > 0 ? (
          <div className="flex flex-col gap-4 rounded-4xl border p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-heading text-2xl">Recent games</h3>
              <Link href="/me/games" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                See all
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              {recordOf(stats.wins, stats.played)}
              {stats.winRate !== null && ` · ${stats.winRate}% win rate`}
            </p>
            <div className="flex flex-col gap-2">
              {recent.map((game) => (
                <GameRecord key={game.id} game={game} timeFormat={account.preferences.timeFormat} />
              ))}
            </div>
          </div>
        ) : (
          <Empty className="border p-6">
            <EmptyHeader>
              <EmptyTitle>No game yet</EmptyTitle>
              <EmptyDescription>Your last games and your stats are listed here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {ranks.length > 0 ? (
          <div className="flex flex-col gap-4 rounded-4xl border p-6">
            <h3 className="font-heading text-2xl">Your ranks</h3>
            <div className="flex flex-col gap-2">
              {ranks.map((entry) => (
                <Item key={entry.slug} size="sm">
                  <ItemMedia>
                    <GameThumb slug={entry.slug} name={entry.name} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      <Link href={`/game/${entry.slug}`} className="hover:underline">
                        {entry.name}
                      </Link>
                    </ItemTitle>
                    {entry.progress && (
                      <ItemDescription>
                        {entry.progress.points}/{entry.progress.needed} pts
                      </ItemDescription>
                    )}
                  </ItemContent>
                  <ItemActions>
                    <RankBadge rank={entry.rank} />
                  </ItemActions>
                </Item>
              ))}
            </div>
          </div>
        ) : (
          <Empty className="border p-6">
            <EmptyHeader>
              <EmptyTitle>No rank yet</EmptyTitle>
              <EmptyDescription>Your rank on each game is shown here once you have played ranked.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </Section>
  )
}
