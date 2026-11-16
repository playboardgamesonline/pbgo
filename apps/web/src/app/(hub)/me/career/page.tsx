import type { Metadata } from "next"
import Link from "next/link"
import { mostRecent } from "@pbgo/accounts"
import { requireAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { AccountShell } from "@/components/account-shell"
import { CareerPanel } from "@/components/career-panel"
import { GameFilter } from "@/components/game-filter"
import { GameRecord } from "@/components/game-record"
import { memberGames, recentGames } from "@/lib/member-games"

export const metadata: Metadata = { title: "Career" }

/** How many finished games the history lists: the latest. */
const HISTORY_GAMES = 50

/**
 * The member's career, under the title of the pages of the navbar's tabs (`AccountShell`'s `title`: Career is a tab of the bar): the history of the games they finished, the latest first, on the left, in a page wider than the other pages of an account (`AccountShell wide`), and on the right their ranks and their figures. A row of buttons over the history, one for each game they
 * finished (`GameFilter`, in the order they were played in, the latest first, whichever game the career is narrowed to: `recentGames`), narrows the career to a game: `?game=<slug>` (the link of a game's page, "See history", lands on it), and the right side is then that game's rank, as the first card of its page says it, with its figures in a list under it; for every game it is the rank in each
 * game they rated, a row each, with their figures over all of them. With one game played there is nothing to narrow to, and the right side is that game's. From `lg` only the history scrolls: the title (pinned by `AccountShell`), the row of buttons (`sticky` under the title, which fades the rows out as they go under it, and where the history has its room above the first row) and the right side (`sticky` too,
 * which scrolls on its own when it is taller than the window, with a quarter of a rem of room round it so that the ring and the shadow of its cards are not cut by that scroll) stay in view, the history ending above a margin at the foot of the window (3.5rem, the foot of the page too: a bar of the page's black over its last rows, with a fade over it, which the cards stop short of too, both above the room of the cookie banner: `--consent-h`), and the room under the title is the margin of the grid (`lg:mt-9`), which scrolls away; the focus of a row that is under them scrolls clear of them (`scroll-pt-80` of the page). Under `lg` nothing sticks, and the right
 * side comes between the row and the history, in a single column that is `grid-cols-1` (a track that may be narrower than what is in it), so that a long name beside a long rank cannot widen the page (the left side is `contents` there, so that its two parts are the grid's own). The games are the recorded ones (PLT-13: `memberGames`): a game that is being played is a table,
 * which the home lists, and is not part of a career yet.
 */
export default async function CareerPage({ searchParams }: { searchParams: Promise<{ game?: string | string[] }> }) {
  const account = await requireAccount("/me/career")
  const { game } = await searchParams
  const asked = typeof game === "string" && game !== "" ? game : undefined
  // The order of the row of games is the one they were played in, whichever game the career is narrowed to: it is read apart from the history
  const [first, recent] = await Promise.all([memberGames(account, HISTORY_GAMES, asked), recentGames(account)])
  let member = first
  // A game they have not finished one of (a link written by hand) narrows nothing: the history is the whole one
  const filter = asked !== undefined && member.perGame.some((row) => row.slug === asked) ? asked : null
  if (asked !== undefined && filter === null) member = await memberGames(account, HISTORY_GAMES)
  const { games, stats, perGame, ranks } = member
  const selected = filter ?? (perGame.length === 1 ? (perGame[0]?.slug ?? null) : null)
  const filterGames = mostRecent(perGame, recent).map(({ slug, name }) => ({ slug, name }))
  const filtered = filterGames.length > 1

  return (
    <AccountShell wide title="Career">
      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:mt-9 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:gap-y-0 lg:[:root:has(&)]:scroll-pt-80">
        <div className="contents lg:block lg:min-w-0">
          {filtered && (
            <GameFilter
              games={filterGames}
              selected={filter}
              className="order-1 lg:sticky lg:top-(--head) lg:z-10 lg:bg-background lg:after:pointer-events-none lg:after:absolute lg:after:inset-x-0 lg:after:top-full lg:after:h-6 lg:after:bg-[linear-gradient(to_bottom,var(--background),transparent)]"
            />
          )}
          <section aria-label="History" className={filtered ? "order-3 lg:pt-6 lg:pb-20" : "order-3 lg:pb-20"}>
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
          <div aria-hidden className="hidden lg:sticky lg:bottom-[var(--consent-h,0px)] lg:z-10 lg:-mt-14 lg:block lg:h-14 lg:bg-background lg:before:absolute lg:before:inset-x-0 lg:before:bottom-full lg:before:h-6 lg:before:bg-[linear-gradient(to_top,var(--background),transparent)]" />
        </div>
        <div className="order-2 lg:sticky lg:top-[calc(var(--head)-0.25rem)] lg:-m-1 lg:max-h-[calc(100svh-var(--head)-3rem-var(--consent-h,0px))] lg:overflow-y-auto lg:p-1">
          <CareerPanel selected={selected} ranks={ranks} perGame={perGame} favourite={stats.favourite} />
        </div>
      </div>
    </AccountShell>
  )
}
