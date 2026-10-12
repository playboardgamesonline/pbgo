import { Alert, AlertDescription, AlertTitle } from "@pbgo/ui/admin/alert"
import { Badge } from "@pbgo/ui/admin/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/admin/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/admin/table"
import { BarChart, dayLabel } from "../../components/admin/bar-chart"
import type { GameEntry, PlayableGame } from "../../lib/binding"
import type { SiteSettings } from "../../lib/settings"
import { gameUrl } from "../../lib/site-url"
import { sanityConfigured } from "../../sanity/client"
import { dataset } from "../../sanity/env"
import { sanityWritable, writeTokenName } from "../../sanity/write-client"
import { adminConfigured } from "../../server/admin"
import { type GameStats, loadGameStats } from "../../server/stats"
import { loadWebAnalytics } from "../../server/vercel"

const NUM = new Intl.NumberFormat("en-GB")
const DATE_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  lobby: { label: "Lobby", variant: "outline" },
  playing: { label: "Playing", variant: "default" },
  over: { label: "Finished", variant: "secondary" },
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="text-sm text-muted-foreground">{hint}</CardContent>}
    </Card>
  )
}

function Check({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span>{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        {detail && <span className="truncate text-muted-foreground">{detail}</span>}
        <Badge variant={ok ? "secondary" : "outline"}>{ok ? "OK" : "To do"}</Badge>
      </span>
    </div>
  )
}

async function gameStats(slug: string): Promise<GameStats | { error: string }> {
  try {
    return await loadGameStats(slug)
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Tables of one game. */
export async function GamesPage({ slug }: { slug: string }) {
  const stats = await gameStats(slug)
  if ("error" in stats)
    return (
      <Alert>
        <AlertTitle>Statistics unavailable</AlertTitle>
        <AlertDescription>{stats.error}</AlertDescription>
      </Alert>
    )
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Playing now" value={NUM.format(stats.active)} hint={`${NUM.format(stats.openLobbies)} open ${stats.openLobbies === 1 ? "lobby" : "lobbies"}`} />
        <Stat label="Games created · 7 d" value={NUM.format(stats.last7d)} hint={`${NUM.format(stats.last24h)} in 24 h · ${NUM.format(stats.total)} in total`} />
        <Stat label="Unique players · 7 d" value={NUM.format(stats.uniquePlayers7d)} hint={`${NUM.format(stats.uniquePlayers30d)} in 30 d`} />
        <Stat
          label="Players per game"
          value={stats.avgPlayers ? stats.avgPlayers.toLocaleString("en-GB", { maximumFractionDigits: 1 }) : "—"}
          hint={stats.started30d ? `${Math.round((stats.finished30d / stats.started30d) * 100)}% of started games are finished` : "No game started in 30 d"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Games created per day</CardTitle>
            <CardDescription>Last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart unit="games" data={stats.perDay.map((d) => ({ label: dayLabel(d.date), value: d.games, detail: `${d.players} players` }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest games</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No game in 30 days.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Players</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent.map((g) => (
                    <TableRow key={g.code}>
                      <TableCell className="font-mono">{g.code}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS[g.status]?.variant ?? "outline"}>{STATUS[g.status]?.label ?? g.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{g.players}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{DATE_TIME.format(new Date(g.createdAt))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Visitors of the whole site: the hub and every game share one Vercel project. */
export async function AudiencePage() {
  const analytics = await loadWebAnalytics()
  if (analytics === null)
    return (
      <Alert>
        <AlertTitle>Not connected</AlertTitle>
        <AlertDescription>
          Enable Web Analytics in the Vercel project (included in the Hobby plan: 50,000 events a month shared by all your projects, 1 month of history), then add VERCEL_TOKEN to see
          the numbers here.
        </AlertDescription>
      </Alert>
    )
  if ("error" in analytics)
    return (
      <Alert>
        <AlertTitle>Web Analytics unavailable</AlertTitle>
        <AlertDescription>{analytics.error}</AlertDescription>
      </Alert>
    )
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Visitors · 30 d" value={NUM.format(analytics.visitors)} />
        <Stat label="Page views · 30 d" value={NUM.format(analytics.pageviews)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Visitors per day</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart unit="visitors" data={analytics.perDay.map((d) => ({ label: dayLabel(d.date), value: d.visitors, detail: `${d.pageviews} page views` }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top pages & countries</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
            <Ranking title="Pages" rows={analytics.topPages.map((p) => ({ label: p.route, value: p.pageviews }))} />
            <Ranking title="Countries" rows={analytics.countries.map((c) => ({ label: c.country, value: c.visitors }))} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

type HealthProps = { game: PlayableGame; games: readonly GameEntry[]; settings: SiteSettings; supabaseOk: boolean }

export async function HealthPage({ game, games, settings, supabaseOk }: HealthProps) {
  const analytics = await loadWebAnalytics()
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  const sanity = sanityConfigured(game)
  const writable = sanityWritable(game)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            This game <Badge variant="outline">{env}</Badge>
          </CardTitle>
          <CardDescription>{gameUrl(game.slug)}</CardDescription>
          {commit && (
            <CardAction>
              <Badge variant="outline" className="font-mono">
                {commit}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="divide-y">
          <Check label="Game" ok detail={`${game.binding.GAME.name} · ${settings.minPlayers}–${settings.maxPlayers} players`} />
          <Check label="Live" ok={game.live} detail={game.live ? (game.indexable ? "Indexed" : "Not indexed yet") : "live: false in packages/games"} />
          <Check label="Admin account" ok={adminConfigured()} />
          <Check label="Supabase" ok={supabaseOk} />
          <Check label="Sanity" ok={sanity} detail={sanity ? `${game.sanityProjectId} / ${dataset}` : "No project id in packages/games"} />
          <Check label="Sanity writes (admin)" ok={writable} detail={writable ? undefined : writeTokenName(game.slug)} />
          <Check label="Vercel Web Analytics" ok={!!analytics && !("error" in analytics)} />
          {process.env.VERCEL_GIT_COMMIT_MESSAGE && <p className="truncate pt-2.5 text-sm text-muted-foreground">{process.env.VERCEL_GIT_COMMIT_MESSAGE}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>PBGO games</CardTitle>
          <CardDescription>Every game of the registry (packages/games)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Game</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sanity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games.map((g) => (
                <TableRow key={g.slug}>
                  <TableCell className="max-w-48 truncate">
                    <a href={`/${g.slug}`} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
                      {g.name}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant={g.live ? "secondary" : "outline"}>{g.live ? (g.indexable ? "Live · indexed" : "Live") : "Coming soon"}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{g.sanityProjectId || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Ranking({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
      {rows.map((r) => (
        <div key={r.label} className="relative flex items-center justify-between gap-3 overflow-hidden rounded-md px-2 py-1 text-sm">
          <div className="absolute inset-y-0 left-0 rounded-md bg-muted" style={{ width: `${(r.value / max) * 100}%` }} />
          <span className="relative truncate">{r.label}</span>
          <span className="relative tabular-nums">{NUM.format(r.value)}</span>
        </div>
      ))}
    </div>
  )
}
