import type { TimeFormat } from "@pbgo/accounts"
import { Badge } from "@pbgo/ui/platform/badge"
import { CoverTile } from "@pbgo/ui/platform/cover-tile"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { Progress } from "@pbgo/ui/platform/progress"
import { cn } from "@pbgo/ui/utils"
import type { GameTournament } from "@/lib/game-activity"
import { perTimeFormat } from "@/lib/time-format"
import { LocalTime } from "./local-time"

// One tournament as a row: its name, when it starts and, for one that can be signed up to, how many places there are and how many are taken. It is the row of the tournaments of a game's page (`GameTournaments`) and of the home's open tournaments (`HomeTournaments`),
// which lists the tournaments of every game and is then given the game, whose picture stands at the left of the row and whose name is said before the date, in a `compact` row, which takes a little less height, since the list there is cut into pages by the height it has. The dates are written in UTC, the same on the server and in the browser, since the page does not know where the visitor is; a `compact` row writes the moment in the reader's own time (`LocalTime`), without the year and without naming the zone.

const WHEN = perTimeFormat(({ hourCycle }) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", hourCycle, timeZone: "UTC" }))

/** The game a tournament is played on, for a row of a list that mixes games: its name and the picture of its tile (`gameThumb`). */
export type TournamentGame = { name: string; picture?: string; logo?: string }

export function TournamentRow({ tournament, timeFormat, game, compact = false }: { tournament: GameTournament; timeFormat: TimeFormat; game?: TournamentGame; compact?: boolean }) {
  const { name, status, startsAt, places, registered } = tournament
  // What stands at the right of the row, if anything: a tournament that is full, or how many played in one that has begun. A row with nothing there has no place for it, which would take the width of a gap
  const trailing = status === "upcoming" ? (registered >= places ? <Badge variant="secondary">Full</Badge> : null) : <span className="text-sm text-muted-foreground tabular-nums">{registered} players</span>
  return (
    <Item size={compact ? "sm" : "default"}>
      {game && (
        <ItemMedia>
          <CoverTile className="size-12" picture={game.picture} logo={game.logo} />
        </ItemMedia>
      )}
      <ItemContent>
        <ItemTitle>{name}</ItemTitle>
        <ItemDescription>
          {game && `${game.name} · `}
          {compact ? <LocalTime iso={startsAt} timeFormat={timeFormat} /> : <time dateTime={startsAt}>{WHEN[timeFormat].format(new Date(startsAt))} UTC</time>}
        </ItemDescription>
        {status === "upcoming" && (
          <div className={cn("flex items-center gap-3", compact ? "mt-1.5" : "mt-2")}>
            <Progress value={Math.min(100, (registered / places) * 100)} aria-label="Places taken" className="h-2 max-w-48 min-w-8 flex-1" />
            <span className="shrink-0 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
              {registered} / {places} registered
            </span>
          </div>
        )}
      </ItemContent>
      {trailing && <ItemActions>{trailing}</ItemActions>}
    </Item>
  )
}
