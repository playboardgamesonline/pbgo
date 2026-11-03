import { Badge } from "@pbgo/ui/platform/badge"
import { RankBadge } from "@pbgo/ui/platform/rank-badge"
import { StatList } from "@pbgo/ui/platform/stat-list"
import { cn } from "@pbgo/ui/utils"
import type { PlayerStats } from "@/lib/game-activity"
import { statFigures } from "@/lib/game-activity-props"

// What the signed-in visitor has done in a game, on the right of their latest games in the band under the head (`GameHistoryStats`): how many games they played and for how long, their win rate, their rank and their position on the board out of how many players, two to a row, each with a word more
// under it, then their achievements by name, in small pills (the description of each is its tooltip). A visitor who has played nothing has the figures at their start, and no achievement. The head of the page has the first three figures in a strip (`GameHead`).

export function GameStats({ stats, className }: { stats: PlayerStats; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <StatList variant="grid" items={statFigures(stats).map(({ rank, value, ...figure }) => ({ ...figure, value: rank ? <RankBadge rank={rank} labelled className="h-9 rounded-lg px-3 text-xl" /> : value }))} />
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-1 text-sm text-muted-foreground">Achievements</h3>
        {stats.achievements.length > 0 ? (
          stats.achievements.map((achievement) => (
            <Badge key={achievement.id} variant="secondary" title={achievement.description}>
              {achievement.name}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">None yet</span>
        )}
      </div>
    </div>
  )
}
