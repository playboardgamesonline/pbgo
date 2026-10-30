import { Badge } from "@pbgo/ui/platform/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { Progress } from "@pbgo/ui/platform/progress"
import type { GameTournament } from "@/lib/game-activity"

// The tournaments of a game, on its page: the ones to come with how many places there are and how many have signed up, the ones in progress and the ones that are over, each group under its own heading and only the groups that
// have a tournament. With none at all, one empty state says what will be listed. The dates are written in UTC, the same on the server and in the browser, since the page does not know where the visitor is.

const GROUPS = [
  { status: "upcoming", title: "Upcoming" },
  { status: "live", title: "In progress" },
  { status: "finished", title: "Finished" },
] as const

const WHEN = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })

function TournamentRow({ tournament }: { tournament: GameTournament }) {
  const { name, status, startsAt, places, registered } = tournament
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{name}</ItemTitle>
        <ItemDescription>
          <time dateTime={startsAt}>{WHEN.format(new Date(startsAt))} UTC</time>
        </ItemDescription>
        {status === "upcoming" && (
          <div className="mt-2 flex items-center gap-3">
            <Progress value={Math.min(100, (registered / places) * 100)} aria-label="Places taken" className="h-2 max-w-48" />
            <span className="text-sm text-muted-foreground tabular-nums">
              {registered} / {places} registered
            </span>
          </div>
        )}
      </ItemContent>
      <ItemActions>
        {status === "upcoming" ? (
          registered >= places && <Badge variant="secondary">Full</Badge>
        ) : (
          <span className="text-sm text-muted-foreground tabular-nums">{registered} players</span>
        )}
      </ItemActions>
    </Item>
  )
}

export function GameTournaments({ tournaments }: { tournaments: readonly GameTournament[] }) {
  return (
    <section aria-labelledby="tournaments">
      <h2 id="tournaments" className="mb-6 font-heading text-2xl">
        Tournaments
      </h2>
      {tournaments.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No tournament yet</EmptyTitle>
            <EmptyDescription>The upcoming, in progress and finished tournaments of this game will be listed here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {GROUPS.map(({ status, title }) => {
            const list = tournaments.filter((tournament) => tournament.status === status)
            return (
              list.length > 0 && (
                <div key={status} className="flex flex-col gap-3">
                  <h3 className="text-muted-foreground">{title}</h3>
                  <ul className="flex flex-col gap-3">
                    {list.map((tournament) => (
                      <li key={tournament.id}>
                        <TournamentRow tournament={tournament} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )
          })}
        </div>
      )}
    </section>
  )
}
