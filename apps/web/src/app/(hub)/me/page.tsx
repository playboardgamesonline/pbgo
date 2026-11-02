import { cookies, headers } from "next/headers"
import Link from "next/link"
import { LANGUAGE_COOKIE, perGame, resolveLanguage, statsOf } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { GameRecord } from "@/components/game-record"
import { LanguageRow } from "@/components/language-row"
import { accountData } from "@/lib/account-data"

/** One figure of the profile, with what it counts. */
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

/**
 * The profile: the figures of the games a visitor has played, the games one by one, and the last of them, then the settings, which are the language for now. The games are empty for a real
 * account until they are recorded (PLT-13 and PLT-16): the page says so and leads to the games. The language shown is the one in use, in the order of the site: the account's, else the
 * cookie's, else the browser's, else English; an account that has never chosen takes it as soon as a page of the hub reads its session (`LanguageSync`).
 */
export default async function ProfilePage() {
  const account = await requireAccount("/me")
  const { games } = accountData(account)
  const [store, requestHeaders] = await Promise.all([cookies(), headers()])
  const language = resolveLanguage({ account: account.language, cookie: store.get(LANGUAGE_COOKIE)?.value, browser: requestHeaders.get("accept-language") })
  const stats = statsOf(games)
  const rows = perGame(games)
  const recent = games.filter((game) => game.state === "finished").slice(0, 3)

  return (
    <div className="flex flex-col gap-10">
      <section aria-label="Figures" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Games played" value={String(stats.played)} />
        <Stat label="Wins" value={String(stats.wins)} />
        <Stat label="Win rate" value={stats.winRate === null ? "—" : `${stats.winRate}%`} />
        <Stat label="Favourite game" value={stats.favourite ?? "—"} />
      </section>

      <section aria-labelledby="per-game">
        <h2 id="per-game" className="mb-4 font-heading text-2xl">
          Your games
        </h2>
        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-4xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game</TableHead>
                  <TableHead className="text-right">Played</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Win rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.slug}>
                    <TableCell>
                      <Link href={`/game/${row.slug}`} className="text-foreground hover:underline">
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{row.played}</TableCell>
                    <TableCell className="text-right">{row.wins}</TableCell>
                    <TableCell className="text-right">{Math.round((row.wins / row.played) * 100)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No game yet</EmptyTitle>
              <EmptyDescription>The games you finish while you are signed in are counted here, game by game.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/games">Pick a game</Link>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="recent" className="font-heading text-2xl">
              Recent games
            </h2>
            <Link href="/me/games" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              See all
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {recent.map((game) => (
              <GameRecord key={game.id} game={game} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="settings">
        <h2 id="settings" className="mb-4 font-heading text-2xl">
          Settings
        </h2>
        <LanguageRow language={language} kept={isDemoAccount(account) ? "device" : "account"} />
      </section>
    </div>
  )
}
