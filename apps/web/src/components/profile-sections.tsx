import Link from "next/link"
import type { TimeFormat } from "@pbgo/accounts"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { RankBadge } from "@pbgo/ui/platform/rank-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { GameRecord } from "@/components/game-record"
import type { MemberGames } from "@/lib/member-games"

/** One figure of a profile, with what it counts. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="truncate font-heading text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

type ProfileSectionsProps = {
  /** Their games, records and ranks; null when the member keeps them private and the visitor is somebody else. */
  games: MemberGames | null
  /** The visitor is the member: an empty profile leads to the games, and a member who hides their games is told so. */
  own: boolean
  /** The member chose to show no games to the others: said to them on their own page, where they see everything. */
  hideHistory: boolean
  /** How many of the latest games are listed. */
  recent: number
  /** Where the whole history is, for the member's own page. */
  allGamesHref?: string
  timeFormat?: TimeFormat
}

/**
 * What a profile says of a member's games, the same on their own page and on anybody's: figures, games with rank and record, and the latest games with their opponents (each opponent with an account links to their profile). The games are the recorded ones (PLT-13). When the member hides their games, another visitor sees only a line that says so. The member sees everything, with a note that the others do not.
 */
export function ProfileSections({ games, own, hideHistory, recent, allGamesHref, timeFormat }: ProfileSectionsProps) {
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
  const { stats, perGame, ranks } = games
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

      <section aria-label="Figures" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Games played" value={String(stats.played)} />
        <Stat label="Wins" value={String(stats.wins)} />
        <Stat label="Win rate" value={stats.winRate === null ? "—" : `${stats.winRate}%`} />
        <Stat label="Favourite game" value={stats.favourite ?? "—"} />
      </section>

      <section aria-labelledby="per-game">
        <h2 id="per-game" className="mb-4 font-heading text-2xl">
          Games
        </h2>
        {perGame.length > 0 ? (
          <div className="overflow-hidden rounded-4xl border">
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
