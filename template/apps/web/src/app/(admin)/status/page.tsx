import { GAME } from "@game/engine"
import type { Metadata } from "next"
import { AdminShell } from "@/components/admin/admin-shell"
import { BarChart, dayLabel } from "@/components/admin/bar-chart"
import { LoginForm } from "@/components/admin/login-form"
import { RefreshButton } from "@/components/admin/refresh-button"
import { Alert, AlertDescription, AlertTitle } from "@pgo/ui/admin/alert"
import { Badge } from "@pgo/ui/admin/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@pgo/ui/admin/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pgo/ui/admin/table"
import { loadSettings } from "@/lib/settings-server"
import { SITE_URL } from "@/lib/site"
import { dataset, projectId } from "@/sanity/env"
import { sanityConfigure } from "@/sanity/client"
import { sanityWritable } from "@/sanity/write-client"
import { adminConfigured, isAdmin } from "@/server/admin"
import { type GameStats, loadGameStats } from "@/server/stats"
import { loadSites, loadWebAnalytics, vercelConfigured } from "@/server/vercel"

export const metadata: Metadata = { title: "Status", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

const NUM = new Intl.NumberFormat("fr-FR")
const DATE_TIME = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  lobby: { label: "Lobby", variant: "outline" },
  playing: { label: "En cours", variant: "default" },
  over: { label: "Terminée", variant: "secondary" },
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
        <Badge variant={ok ? "secondary" : "outline"}>{ok ? "OK" : "À faire"}</Badge>
      </span>
    </div>
  )
}

async function gameStats(): Promise<GameStats | { error: string }> {
  try {
    return await loadGameStats()
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export default async function StatusPage() {
  const settings = await loadSettings()
  if (!(await isAdmin())) return <LoginForm title={settings.title} configured={adminConfigured()} />
  const [stats, analytics, sites] = await Promise.all([gameStats(), loadWebAnalytics(), loadSites()])
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)

  return (
    <AdminShell title={settings.title} logo={settings.logo}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            Status <Badge variant="outline">{env}</Badge>
          </h1>
          <p className="text-muted-foreground">Mis à jour le {DATE_TIME.format(new Date())}</p>
        </div>
        <RefreshButton />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Parties</h2>
        {"error" in stats ? (
          <Alert>
            <AlertTitle>Statistiques indisponibles</AlertTitle>
            <AlertDescription>{stats.error}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="En cours" value={NUM.format(stats.active)} hint={`${stats.openLobbies} lobby${stats.openLobbies > 1 ? "s" : ""} ouvert${stats.openLobbies > 1 ? "s" : ""}`} />
              <Stat label="Parties créées · 7 j" value={NUM.format(stats.last7d)} hint={`${NUM.format(stats.last24h)} sur 24 h · ${NUM.format(stats.total)} au total`} />
              <Stat label="Joueurs uniques · 7 j" value={NUM.format(stats.uniquePlayers7d)} hint={`${NUM.format(stats.uniquePlayers30d)} sur 30 j`} />
              <Stat
                label="Joueurs par partie"
                value={stats.avgPlayers ? stats.avgPlayers.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
                hint={stats.started30d ? `${Math.round((stats.finished30d / stats.started30d) * 100)} % des parties lancées vont au bout` : "Aucune partie lancée sur 30 j"}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Parties créées par jour</CardTitle>
                  <CardDescription>14 derniers jours</CardDescription>
                </CardHeader>
                <CardContent>
                  <BarChart unit="parties" data={stats.perDay.map((d) => ({ label: dayLabel(d.date), value: d.games, detail: `${d.players} joueurs` }))} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Dernières parties</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune partie sur 30 jours.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Joueurs</TableHead>
                          <TableHead className="text-right">Créée</TableHead>
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
          </>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Audience · Vercel Web Analytics</h2>
        {analytics === null ? (
          <Alert>
            <AlertTitle>Non connecté</AlertTitle>
            <AlertDescription>
              Activez Web Analytics dans le projet Vercel (inclus dans le plan Hobby : 50 000 événements / mois partagés entre tous vos projets, 1 mois d&apos;historique),
              puis ajoutez VERCEL_TOKEN pour afficher les chiffres ici.
            </AlertDescription>
          </Alert>
        ) : "error" in analytics ? (
          <Alert>
            <AlertTitle>Web Analytics indisponible</AlertTitle>
            <AlertDescription>{analytics.error}</AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Visiteurs par jour</CardTitle>
                <CardDescription>
                  30 derniers jours · {NUM.format(analytics.visitors)} visiteurs · {NUM.format(analytics.pageviews)} pages vues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart unit="visiteurs" data={analytics.perDay.map((d) => ({ label: dayLabel(d.date), value: d.visitors, detail: `${d.pageviews} pages vues` }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top pages & pays</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                <Ranking title="Pages" rows={analytics.topPages.map((p) => ({ label: p.route, value: p.pageviews }))} />
                <Ranking title="Pays" rows={analytics.countries.map((c) => ({ label: c.country, value: c.visitors }))} />
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ce site</CardTitle>
            <CardDescription>{SITE_URL}</CardDescription>
            {commit && (
              <CardAction>
                <Badge variant="outline" className="font-mono">
                  {commit}
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="divide-y">
            <Check label="Jeu" ok detail={`${GAME.name} · ${settings.minPlayers}–${settings.maxPlayers} joueurs`} />
            <Check label="Compte admin" ok={adminConfigured()} />
            <Check label="Supabase" ok={!("error" in stats)} />
            <Check label="Sanity" ok={sanityConfigure} detail={sanityConfigure ? `${projectId} / ${dataset}` : undefined} />
            <Check label="Écriture Sanity (/setup)" ok={sanityWritable} />
            <Check label="Vercel Web Analytics" ok={!!analytics && !("error" in analytics)} />
            {process.env.VERCEL_GIT_COMMIT_MESSAGE && <p className="truncate pt-2.5 text-sm text-muted-foreground">{process.env.VERCEL_GIT_COMMIT_MESSAGE}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sites Play Game Online</CardTitle>
            <CardDescription>Projets du compte Vercel · visiteurs sur 7 jours</CardDescription>
          </CardHeader>
          <CardContent>
            {!vercelConfigured || sites === null ? (
              <p className="text-sm text-muted-foreground">Ajoutez VERCEL_TOKEN pour lister vos sites.</p>
            ) : "error" in sites ? (
              <p className="text-sm text-muted-foreground">Liste indisponible : {sites.error}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Déploiement</TableHead>
                    <TableHead className="text-right">Visiteurs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-48 truncate">
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-4 hover:underline">
                            {s.name}
                          </a>
                        ) : (
                          s.name
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.state && <Badge variant={s.state === "READY" ? "secondary" : "outline"}>{s.state === "READY" ? "En ligne" : s.state.toLowerCase()}</Badge>}{" "}
                        {s.deployedAt ? DATE_TIME.format(new Date(s.deployedAt)) : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.visitors7d === null ? "—" : NUM.format(s.visitors7d)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  )
}

function Ranking({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Pas encore de données.</p>}
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
