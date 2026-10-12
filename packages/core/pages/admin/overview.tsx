import Link from "next/link"
import { redirect } from "next/navigation"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { AdminShell, PageHeader } from "../../components/admin/admin-shell"
import { GameMark } from "../../components/admin/game-switcher"
import { adminHref, GAMEMASTER_PATH, LOGIN_PATH } from "../../lib/admin-nav"
import type { GameEntry } from "../../lib/binding"
import { sanityConfigured } from "../../sanity/client"
import { sanityWritable, writeTokenName } from "../../sanity/write-client"
import { isAdmin } from "../../server/admin"
import { switcherGames } from "./games"

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 justify-end">{children}</dd>
    </>
  )
}

/** One game of the registry. Health here is what the environment says, with no call to Sanity or Supabase: the overview lists every game on one page. */
function GameOverview({ game }: { game: GameEntry }) {
  const configured = sanityConfigured(game)
  const writable = sanityWritable(game)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-3">
          <GameMark game={game} size="lg" />
          <span className="min-w-0 truncate">{game.name}</span>
        </CardTitle>
        <CardDescription>/{game.slug}</CardDescription>
        <CardAction className="flex gap-1.5">
          <Badge variant={game.live ? "secondary" : "outline"}>{game.live ? "Live" : "Coming soon"}</Badge>
          {game.indexable && <Badge variant="outline">Indexed</Badge>}
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-sm">
          <Fact label="Sanity project">
            <span className="truncate font-mono text-xs">{configured ? game.sanityProjectId : "Not set"}</span>
          </Fact>
          <Fact label="Saving to Sanity">
            <Badge variant={writable ? "secondary" : "outline"} title={writable ? undefined : `${writeTokenName(game.slug)} is missing`}>
              {writable ? "Connected" : "Read-only"}
            </Badge>
          </Fact>
        </dl>
      </CardContent>
      <CardFooter className="gap-2">
        <Button asChild size="sm">
          <Link href={adminHref(game.slug)} prefetch={false}>
            Open
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={adminHref(game.slug, "tasks/launch")} prefetch={false}>
            Launch
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={adminHref(game.slug, "monitoring/health")} prefetch={false}>
            Health
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

/** `/gamemaster`: every game of the registry on one page. */
export async function OverviewPage({ games }: { games: readonly GameEntry[] }) {
  if (!(await isAdmin())) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(GAMEMASTER_PATH)}`)
  const live = games.filter((g) => g.live).length
  return (
    <AdminShell games={switcherGames(games)} game={null}>
      <PageHeader title="Gamemaster" description={`${games.length} games, ${live} live. Pick one in the sidebar, or open it from here.`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => (
          <GameOverview key={game.slug} game={game} />
        ))}
      </div>
    </AdminShell>
  )
}
