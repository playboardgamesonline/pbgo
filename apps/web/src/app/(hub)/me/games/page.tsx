import type { Metadata } from "next"
import Link from "next/link"
import { requireAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameRecord } from "@/components/game-record"
import { accountData } from "@/lib/account-data"

export const metadata: Metadata = { title: "Your games" }

/**
 * My games: the tables a visitor is at and can go back to, then the games they have finished, the latest first. Both are empty for a real account until the
 * tables and the results are recorded (PLT-13, PLT-16): each says so and leads to the games.
 */
export default async function MyGamesPage() {
  const account = await requireAccount("/me/games")
  const { games } = accountData(account)
  const inProgress = games.filter((game) => game.state === "in-progress")
  const finished = games.filter((game) => game.state === "finished")

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="in-progress">
        <h2 id="in-progress" className="mb-4 font-heading text-2xl">
          In progress
        </h2>
        {inProgress.length > 0 ? (
          <div className="flex flex-col gap-2">
            {inProgress.map((game) => (
              <GameRecord key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No game in progress</EmptyTitle>
              <EmptyDescription>The tables you are at show up here, so you can go back to them from any device.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/games">Start a game</Link>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </section>

      <section aria-labelledby="history">
        <h2 id="history" className="mb-4 font-heading text-2xl">
          History
        </h2>
        {finished.length > 0 ? (
          <div className="flex flex-col gap-2">
            {finished.map((game) => (
              <GameRecord key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No finished game yet</EmptyTitle>
              <EmptyDescription>Once a game is over, its result, its rank and who you played against are kept here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </div>
  )
}
