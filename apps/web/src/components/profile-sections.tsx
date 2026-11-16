import Link from "next/link"
import { FavouriteIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { figuresOf, type GameFigures, type GameTotals, type TimeFormat } from "@pbgo/accounts"
import { getCatalog } from "@pbgo/catalog/server"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { CoverTile } from "@pbgo/ui/platform/cover-tile"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { RankBadge } from "@pbgo/ui/platform/rank-badge"
import { StatBar, StatBarItem, StatBarNote, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { lengthOf } from "@pbgo/ui/results"
import { GameRecord } from "@/components/game-record"
import { FriendsZone } from "@/components/profile-friends"
import { gameThumb } from "@/lib/game-thumb"
import type { MemberGames } from "@/lib/member-games"
import type { ProfileFriend } from "@/lib/profile-friends"

/** The row of figures under the games they play the most, in zones of their own (`StatBar`, as the stats of a game's page are): the time they played with the number of games under it, the share they won with the number of wins under it and, on the member's own page, their friends. The first two
 * share the row, side by side from the narrowest screen; the friends take a line of their own under them until `lg`, where the three stand in a row and the friends have the most room. Without the friends (another visitor's view) the two have the row. */
function Zones({ figures, friends }: { figures: GameFigures; friends?: readonly ProfileFriend[] | null }) {
  const number = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  return (
    <StatBar aria-label="Figures" className={friends ? "grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)]" : "grid-cols-2"}>
      <StatBarItem label="Playtime">
        <StatBarValue className="truncate text-2xl leading-8 sm:text-3xl sm:leading-9">{figures.seconds > 0 ? lengthOf(figures.seconds) : "—"}</StatBarValue>
        <StatBarNote>{number(figures.played, "game", "games")}</StatBarNote>
      </StatBarItem>
      <StatBarItem label="Win rate">
        <StatBarValue className="truncate text-2xl leading-8 sm:text-3xl sm:leading-9">{figures.winRate === null ? "—" : `${figures.winRate}%`}</StatBarValue>
        <StatBarNote>{number(figures.wins, "win", "wins")}</StatBarNote>
      </StatBarItem>
      {friends && <FriendsZone friends={friends} className="col-span-2 lg:col-span-1" />}
    </StatBar>
  )
}

/** How many of the games they played the most are shown as tiles. */
const FAVORITES = 6

/**
 * The games they play the most, as tiles with their names under them, each leading to its page: six at the most, the most played first. The member picks none of them: what they played says it, so the title is a filled heart and not the word. A game that is not in the catalog any
 * more is left out. Nothing for a member who has played nothing.
 */
async function Favorites({ perGame }: { perGame: readonly GameTotals[] }) {
  const top = perGame.filter((row) => row.played > 0).slice(0, FAVORITES)
  if (top.length === 0) return null
  const { entries } = await getCatalog()
  const games = top.flatMap((row) => entries.find((entry) => entry.slug === row.slug) ?? [])
  if (games.length === 0) return null
  return (
    <section aria-labelledby="favorites">
      <h2 id="favorites" className="mb-4 flex items-center gap-3 font-heading text-2xl">
        <HugeiconsIcon icon={FavouriteIcon} fill="currentColor" aria-hidden="true" className="size-6 shrink-0" />
        <span>
          <span className="sr-only">Favorite </span>Board games
        </span>
      </h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-5">
        {games.map((entry) => (
          <li key={entry.slug}>
            <Link href={`/game/${entry.slug}`} className="group/favorite flex w-24 flex-col gap-2 outline-none sm:w-28">
              <CoverTile
                className="size-auto w-24 aspect-4/3 ring-1 ring-foreground/10 transition-shadow duration-fast group-hover/favorite:ring-foreground/30 group-focus-visible/favorite:ring-3 group-focus-visible/favorite:ring-ring/30 sm:w-28"
                {...gameThumb(entry.game)}
              />
              <span className="line-clamp-2 text-sm leading-snug group-hover/favorite:underline">{entry.game.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

type ProfileSectionsProps = {
  /** Their games, records and ranks; null when the member keeps them private and the visitor is somebody else. */
  games: MemberGames | null
  /** The visitor is the member: an empty profile leads to the games, and a member who hides their games is told so. */
  own: boolean
  /** The member chose to show no games to the others: said to them on their own page, where they see everything. */
  hideHistory: boolean
  /** The member's friends, for their own page only: another visitor never sees a list of friends. Null or absent: no block (null where they could not be read). */
  friends?: readonly ProfileFriend[] | null
  /** How many of the latest games are listed. */
  recent: number
  /** Where the whole history is, for the member's own page. */
  allGamesHref?: string
  timeFormat?: TimeFormat
}

/**
 * What a profile says of a member's games, the same on their own page and on anybody's: the games they play the most, their figures in zones (the time they played with the games, their win rate with their wins and, on their own page, their friends), a table of the games with rank and record (with no title on the page), and the latest games with their opponents (each opponent with an account links to their profile). The games are the recorded ones (PLT-13). When the member hides their games, another visitor sees only a line that says so. The member sees everything, with a note that the others do not.
 */
export function ProfileSections({ games, own, hideHistory, friends, recent, allGamesHref, timeFormat }: ProfileSectionsProps) {
  if (games === null) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Games are private</EmptyTitle>
          <EmptyDescription>This player chose not to show their games.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const { perGame, ranks } = games
  const figures = figuresOf(perGame)
  const rankIn = new Map(ranks.map((entry) => [entry.slug, entry.rank]))
  const latest = games.games.filter((game) => game.state === "finished").slice(0, recent)

  return (
    <div className="flex flex-col gap-10">
      {own && hideHistory && (
        <Alert>
          <AlertDescription>
            Your games are hidden from the other players: they see your name and your picture, and nothing else.{" "}
            <Link href="/me/settings/privacy" className="text-foreground underline underline-offset-4">
              Change it in Data &amp; Privacy
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Favorites perGame={perGame} />

      <Zones figures={figures} friends={friends} />

      <section aria-labelledby="per-game">
        {/* No title on the page: its columns say what the table is, and the heading of the games played the most is the only one that shows. This one is for screen readers */}
        <h2 id="per-game" className="sr-only">
          Stats by game
        </h2>
        {perGame.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead className="text-right">Played</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Win rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perGame.map((row) => {
                  const rank = rankIn.get(row.slug)
                  return (
                    <TableRow key={row.slug}>
                      <TableCell>
                        <Link href={`/game/${row.slug}`} className="text-foreground hover:underline">
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell>{rank ? <RankBadge rank={rank} labelled /> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right">{row.played}</TableCell>
                      <TableCell className="text-right">{row.wins}</TableCell>
                      <TableCell className="text-right">{Math.round((row.wins / row.played) * 100)}%</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No game yet</EmptyTitle>
              <EmptyDescription>{own ? "The games you finish while you are signed in are counted here, game by game." : "This player has not finished a game yet."}</EmptyDescription>
            </EmptyHeader>
            {own && (
              <EmptyContent>
                <Button asChild>
                  <Link href="/games">Pick a game</Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}
      </section>

      {latest.length > 0 && (
        <section aria-labelledby="recent">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="recent" className="font-heading text-2xl">
              Recent games
            </h2>
            {allGamesHref && (
              <Link href={allGamesHref} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                See all
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {latest.map((game) => (
              <GameRecord key={game.id} game={game} timeFormat={timeFormat} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
