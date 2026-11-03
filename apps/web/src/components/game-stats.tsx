import Link from "next/link"
import { Analytics01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AchievementTile } from "@pbgo/ui/platform/achievement-tile"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardContent } from "@pbgo/ui/platform/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import { RankBadge } from "@pbgo/ui/platform/rank-badge"
import { StatList } from "@pbgo/ui/platform/stat-list"
import { cn } from "@pbgo/ui/utils"
import type { PlayerStats } from "@/lib/game-activity"
import { dayOf, statFigures } from "@/lib/game-activity-props"

// What the signed-in visitor has done in a game, as a column on the right of their history (`GameHistoryStats`): how many games they played and for how long, their win rate, their rank and their position on the board out of how many players, one to a row, then the
// achievements they earned, as badges (a drawn emblem, the name, the day), counted in a small pill beside their title. A visitor who has played nothing has the figures at their start, and no achievement. The head of the page has the first three figures in a strip (`GameHead`).
// A visitor who is not signed in has nothing to show, so one prompt invites them to sign in, in place of the history and the column (`GameStatsSignIn`).

export function GameStats({ stats, className }: { stats: PlayerStats; className?: string }) {
  return (
    <Card className={cn("@container", className)}>
      <CardContent>
        <StatList items={statFigures(stats).map(({ rank, value, ...figure }) => ({ ...figure, value: rank ? <RankBadge rank={rank} labelled className="h-9 rounded-lg px-3 text-xl" /> : value }))} />
      </CardContent>
      <CardContent className="flex flex-col gap-3 border-t pt-(--card-spacing)">
        <h3 className="flex items-center gap-2 text-sm text-muted-foreground">
          Achievements
          <Badge variant="secondary">{stats.achievements.length}</Badge>
        </h3>
        {stats.achievements.length > 0 ? (
          <ul className="grid grid-cols-3 gap-x-3 gap-y-6 @lg:grid-cols-4 @2xl:grid-cols-6">
            {stats.achievements.map((achievement) => (
              <li key={achievement.id}>
                <AchievementTile badge={achievement.id} name={achievement.name} date={dayOf(achievement.earnedAt)} description={achievement.description} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No achievement yet. The ones you earn in this game will be listed here.</p>
        )}
      </CardContent>
    </Card>
  )
}

/** What a visitor who is not signed in finds where their games and their stats would be: an invitation to sign in, which brings them back to the game's page. */
export function GameStatsSignIn({ slug }: { slug: string }) {
  return (
    <Empty className="border p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Keep track of your games</EmptyTitle>
        <EmptyDescription>Sign in to see your games, your win rate, your rank and your achievements in this game.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" asChild>
          <Link href={`/login?next=${encodeURIComponent(`/game/${slug}`)}`}>Sign in</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
