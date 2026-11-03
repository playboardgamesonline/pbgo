import { Badge } from "@pbgo/ui/platform/badge"
import { RankBadge } from "@pbgo/ui/platform/rank-badge"
import { StatList } from "@pbgo/ui/platform/stat-list"
import type { PlayerStats } from "@/lib/game-activity"
import { statFigures } from "@/lib/game-activity-props"

// What the signed-in visitor has done in a game, in one line in the thin banner under the head (`GameHistoryStats`): how many games they played and for how long, their win rate, their rank and their position on the board out of how many players, each under its label with a word more beside it, then their
// achievements by name, in small pills (the description of each is its tooltip), two figures to a row on a narrow screen. A visitor who has played nothing has the figures at their start, and no achievement. The head of the page has the first three figures in a strip (`GameHead`).

export function GameStats({ stats, className }: { stats: PlayerStats; className?: string }) {
  const figures = statFigures(stats).map(({ rank, value, ...figure }) => ({ ...figure, value: rank ? <RankBadge rank={rank} labelled className="h-6 rounded-md px-2 text-sm" /> : value }))
  const achievements = {
    label: "Achievements",
    value:
      stats.achievements.length > 0 ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {stats.achievements.map((achievement) => (
            <Badge key={achievement.id} variant="secondary" title={achievement.description}>
              {achievement.name}
            </Badge>
          ))}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">None yet</span>
      ),
  }
  return <StatList variant="bar" items={[...figures, achievements]} className={className} />
}
