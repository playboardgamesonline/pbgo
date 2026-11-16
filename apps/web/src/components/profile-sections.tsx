import Link from "next/link"
import { FavouriteIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { figuresOf, type GameTotals, type TimeFormat } from "@pbgo/accounts"
import { getCatalog } from "@pbgo/catalog/server"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardContent, CardDescription, CardTitle } from "@pbgo/ui/platform/card"
import { CoverTile } from "@pbgo/ui/platform/cover-tile"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { RankBadge } from "@pbgo/ui/platform/rank-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { lengthOf } from "@pbgo/ui/results"
import { GameRecord } from "@/components/game-record"
import { ProfileFriends } from "@/components/profile-friends"
import { gameThumb } from "@/lib/game-thumb"
import type { MemberGames } from "@/lib/member-games"
import type { ProfileFriend } from "@/lib/profile-friends"

/** One figure of a profile, with what it counts. */
type Figure = { label: string; value: string }

/** Two figures that belong together, as one block: each with what it counts above it, side by side with a line between them. */
function FigurePair({ figures }: { figures: readonly [Figure, Figure] }) {
  return (
    <Card size="sm">
      <CardContent className="grid grid-cols-2 gap-x-6">
        {figures.map(({ label, value }, index) => (
          <div key={label} className={index === 0 ? "flex min-w-0 flex-col gap-1.5" : "flex min-w-0 flex-col gap-1.5 border-l pl-6"}>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="truncate font-heading text-3xl tabular-nums">{value}</CardTitle>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/** How many of the games they played the most are shown as tiles. */
const FAVORITES = 5

/**
 * The games they play the most, as tiles with their names under them, each leading to its page: five at the most, the most played first. The member picks none of them: what they played says it, so the title is a filled heart and not the word. A game that is not in the catalog any
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
 * What a profile says of a member's games, the same on their own page and on anybody's: the games they play the most, their figures in two blocks (the time they played with the games, their win rate with their wins), their friends (their own page only), a table of the games with rank and record (with no title on the page), and the latest games with their opponents (each opponent with an account links to their profile). The games are the recorded ones (PLT-13). When the member hides their games, another visitor sees only a line that says so. The member sees everything, with a note that the others do not.
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

      <section aria-label="Figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FigurePair
          figures={[
            { label: "Time played", value: figures.seconds > 0 ? lengthOf(figures.seconds) : "—" },
            { label: "Games played", value: String(figures.played) },
          ]}
        />
        <FigurePair
          figures={[
            { label: "Win rate", value: figures.winRate === null ? "—" : `${figures.winRate}%` },
            { label: "Wins", value: String(figures.wins) },
          ]}
        />
      </section>

      {friends && <ProfileFriends friends={friends} />}

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
