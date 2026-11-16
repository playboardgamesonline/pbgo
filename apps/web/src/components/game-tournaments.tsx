import { Calendar03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { TimeFormat } from "@pbgo/accounts"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import type { GameTournament } from "@/lib/game-activity"
import { TournamentRow } from "./tournament-row"

// The tournaments of a game, on its page: the ones to come with how many places there are and how many have signed up, the ones in progress and the ones that are over, each group under its own heading and only the groups that have a tournament (each is a `TournamentRow`). With none at all,
// one empty state says what will be listed.

const GROUPS = [
  { status: "upcoming", title: "Upcoming" },
  { status: "live", title: "In progress" },
  { status: "finished", title: "Finished" },
] as const

export function GameTournaments({ tournaments, timeFormat = "auto" }: { tournaments: readonly GameTournament[]; timeFormat?: TimeFormat }) {
  return (
    <section aria-labelledby="tournaments" className="@container">
      <h2 id="tournaments" className="mb-6 font-heading text-2xl">
        Tournaments
      </h2>
      {tournaments.length === 0 ? (
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No tournament yet</EmptyTitle>
            <EmptyDescription>The upcoming, in progress and finished tournaments of this game will be listed here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-8 @2xl:grid-cols-2 @4xl:grid-cols-3">
          {GROUPS.map(({ status, title }) => {
            const list = tournaments.filter((tournament) => tournament.status === status)
            return (
              list.length > 0 && (
                <div key={status} className="flex flex-col gap-3">
                  <h3 className="text-muted-foreground">{title}</h3>
                  <ul className="flex flex-col gap-3">
                    {list.map((tournament) => (
                      <li key={tournament.id}>
                        <TournamentRow tournament={tournament} timeFormat={timeFormat} />
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
