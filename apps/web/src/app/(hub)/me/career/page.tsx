import type { Metadata } from "next"
import Link from "next/link"
import { requireAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { AccountShell } from "@/components/account-shell"
import { CareerPanel } from "@/components/career-panel"
import { GameFilter } from "@/components/game-filter"
import { GameRecord } from "@/components/game-record"
import { memberGames } from "@/lib/member-games"

export const metadata: Metadata = { title: "Career" }

/** How many finished games the history lists: the latest. */
const HISTORY_GAMES = 50

/**
 * The member's career, with no head of its own: the history of the games they finished, the latest first, on the left, as wide as the page lets it be, and on the right their ranks and their figures. A row of buttons over the history, one for each game they
 * finished (`GameFilter`), narrows the career to a game: `?game=<slug>` (the link of a game's page, "See history", lands on it), and the right side is then that game's rank, as the first card of its page says it, with its figures in a list under it; for every game it is the rank in each
 * game they rated, a row each, with their figures over all of them. With one game played there is nothing to narrow to, and the right side is that game's. Under `lg` the right side comes first, in a single column that is `grid-cols-1` (a track that may be narrower than what is in it), so that a long name beside a long rank cannot widen the page. The games are the recorded ones (PLT-13: `memberGames`): a game that is being played is a table,
 * which the home lists, and is not part of a career yet.
 */
export default async function CareerPage({ searchParams }: { searchParams: Promise<{ game?: string | string[] }> }) {
  const account = await requireAccount("/me/career")
  const { game } = await searchParams
  const asked = typeof game === "string" && game !== "" ? game : undefined
  let member = await memberGames(account, HISTORY_GAMES, asked)
  // A game they have not finished one of (a link written by hand) narrows nothing: the history is the whole one
  const filter = asked !== undefined && member.perGame.some((row) => row.slug === asked) ? asked : null
  if (asked !== undefined && filter === null) member = await memberGames(account, HISTORY_GAMES)
  const { games, stats, perGame, ranks } = member
  const selected = filter ?? (perGame.length === 1 ? (perGame[0]?.slug ?? null) : null)

  return (
    <AccountShell wide>
      <h1 className="sr-only">Career</h1>
      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:grid-rows-[auto_1fr] lg:gap-y-0">
        {perGame.length > 1 && <GameFilter games={perGame.map(({ slug, name }) => ({ slug, name }))} selected={filter} className="lg:col-start-1 lg:row-start-1 lg:mb-6" />}
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <CareerPanel selected={selected} ranks={ranks} perGame={perGame} favourite={stats.favourite} />
        </div>
        <section aria-label="History" className="lg:col-start-1 lg:row-start-2">
          {games.length > 0 ? (
            <div className="flex flex-col gap-3">
              {games.map((played) => (
                <GameRecord key={played.id} game={played} timeFormat={account.preferences.timeFormat} />
              ))}
            </div>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No finished game yet</EmptyTitle>
                <EmptyDescription>Once a game is over, its result, its rank and who you played against are kept here.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link href="/games">Pick a game</Link>
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </section>
      </div>
    </AccountShell>
  )
}
