import type { ReactNode } from "react"
import { useId } from "react"
import Link from "next/link"
import { Analytics01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AchievementTile } from "@pbgo/ui/platform/achievement-tile"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardContent } from "@pbgo/ui/platform/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import { StatTile } from "@pbgo/ui/platform/stat-tile"
import type { PlayerStats } from "@/lib/game-activity"
import { dayOf, statFigures } from "@/lib/game-activity-props"

// What the signed-in visitor has done in a game, on its page: how many games they played, their win rate, their rating and their place on the board out of how many players, then the achievements they earned, as badges (a drawn emblem, the
// name, the day), counted in a small pill beside their title. A visitor who is not signed in has nothing to show, so it invites them to (`stats` is null: `getPlayerStats` knows nobody). A visitor who is signed in and has played nothing has the figures at their start, and no achievement.
// What goes under the card (the visitor's latest games, `GameHistory`) is its children, in the same section.

export function GameStats({ slug, stats, className, children }: { slug: string; stats: PlayerStats | null; className?: string; children?: ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className={className}>
      <h2 id={headingId} className="mb-6 font-heading text-2xl">
        Your stats
      </h2>
      {stats === null ? (
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Keep track of your games</EmptyTitle>
            <EmptyDescription>Sign in to see your games, your win rate, your rating and your achievements in this game.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" asChild>
              <Link href={`/login?next=${encodeURIComponent(`/game/${slug}`)}`}>Sign in</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card className="@container">
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-8 @xl:grid-cols-4">
              {statFigures(stats).map((figure) => (
                <StatTile key={figure.label} {...figure} />
              ))}
            </dl>
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
      )}
      {children && <div className="mt-4 empty:hidden">{children}</div>}
    </section>
  )
}
