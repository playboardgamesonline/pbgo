import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { AdminGameProvider } from "../components/admin/admin-game"
import { AdminShell, PageHeader } from "../components/admin/admin-shell"
import { RefreshButton } from "../components/admin/refresh-button"
import { AudioPage } from "../components/admin/setup/audio"
import { CopyPage } from "../components/admin/setup/copy"
import { IdentityPage } from "../components/admin/setup/identity"
import { MechanicsPage } from "../components/admin/setup/mechanics"
import { VisualPage } from "../components/admin/setup/visual"
import { FeedbackList } from "../components/admin/tasks/feedback-list"
import { TaskBoard } from "../components/admin/tasks/task-board"
import { type AdminPath, adminHref, findAdminItem, LOGIN_PATH } from "../lib/admin-nav"
import type { GameEntry, GameModule } from "../lib/binding"
import { defaultTheme, playerBounds } from "../lib/settings"
import { loadSettings } from "../lib/settings-server"
import { SITE_URL } from "../lib/site-url"
import { creditTexts } from "../lib/skin"
import { isProjectId } from "../sanity/env"
import { isAdmin } from "../server/admin"
import { launchChecklist } from "../server/launch"
import { readAdminData } from "../server/settings"
import { supabaseAdmin } from "../server/supabase"
import { taskCounts } from "../server/tasks"
import { switcherGames } from "./admin/games"
import { LaunchPage } from "./admin/launch"
import { AudiencePage, GamesPage, HealthPage } from "./admin/monitoring"

/** `generateMetadata` of `/gamemaster/[game]/[[...section]]`. `game`: the registry entry, absent for a slug that is not a game. */
export function adminMetadata(game: Pick<GameEntry, "name"> | null | undefined, section: string[] | undefined): Metadata {
  const robots = { index: false, follow: false }
  if (!game) return { robots }
  const item = findAdminItem(section?.join("/") ?? "")
  return { title: item ? `${item.label} · ${game.name}` : game.name, robots }
}

/** Sanity Studio of the game: `STUDIO_URL` of its binding, else the project's page on sanity.io. */
const studioUrl = (game: GameModule) =>
  game.binding.STUDIO_URL ?? (isProjectId(game.sanityProjectId) ? `https://www.sanity.io/manage/project/${game.sanityProjectId}` : null)

const DEFAULTS: Record<string, AdminPath> = { "": "identity", tasks: "tasks/launch", monitoring: "monitoring/games" }

async function supabaseOk(slug: string) {
  try {
    const { error } = await supabaseAdmin().from("games").select("code", { count: "exact", head: true }).eq("game", slug)
    return !error
  } catch {
    return false
  }
}

/**
 * Gamemaster page of a game: `/gamemaster/<slug>/<page>`. Setup (Identity, Mechanics, Visual, Audio, Copy), Tasks, Monitoring.
 * `games`: every game of the registry, for the switcher and Monitoring › Health. Nothing here needs the game to be playable: a game
 * without engine, or not live in production, is edited like any other.
 */
export async function AdminPage({ game, section, games }: { game: GameModule; section: string[] | undefined; games: readonly GameEntry[] }) {
  const path = section?.join("/") ?? ""
  const item = findAdminItem(path)

  // The session comes first: a visitor without one learns nothing about which pages exist. The way back is rebuilt from known pages, never from the URL.
  if (!(await isAdmin())) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(adminHref(game.slug, item?.path))}`)
  if (DEFAULTS[path]) redirect(adminHref(game.slug, DEFAULTS[path]))
  if (!item) notFound()

  const monitoring = item.path.startsWith("monitoring/")
  const needsData = !monitoring && item.path !== "tasks/backlog" && item.path !== "tasks/bugs" && item.path !== "tasks/feedback"
  const [data, counts] = await Promise.all([
    needsData ? readAdminData(game) : null,
    taskCounts(game.slug).catch(() => ({ backlog: null, bugs: null, feedback: null })),
  ])
  const launch = data && item.path === "tasks/launch" ? await launchChecklist(game, data) : null
  const domain = (() => {
    try {
      return new URL(SITE_URL).hostname
    } catch {
      return "localhost"
    }
  })()
  const studio = studioUrl(game)

  let body: React.ReactNode
  switch (item.path) {
    case "identity":
      body = <IdentityPage initial={data!} domain={domain} credits={creditTexts(game.binding)} />
      break
    case "mechanics":
      body = <MechanicsPage initial={data!} studioUrl={studio} options={Object.entries(game.binding.GAME?.options ?? {})} bounds={playerBounds(game.binding)} />
      break
    case "visual":
      body = <VisualPage initial={data!} defaultTheme={defaultTheme(game.binding)} />
      break
    case "audio":
      body = <AudioPage initial={data!} />
      break
    case "copy":
      body = <CopyPage initial={data!} />
      break
    case "tasks/launch":
      body = <LaunchPage slug={game.slug} items={launch!} />
      break
    case "tasks/backlog":
      body = <TaskBoard type="backlog" />
      break
    case "tasks/bugs":
      body = <TaskBoard type="bug" />
      break
    case "tasks/feedback":
      body = <FeedbackList />
      break
    case "monitoring/games":
      body = <GamesPage slug={game.slug} />
      break
    case "monitoring/audience":
      body = <AudiencePage />
      break
    case "monitoring/health":
      body = <HealthPage game={game} games={games} settings={await loadSettings(game)} supabaseOk={await supabaseOk(game.slug)} />
      break
  }

  return (
    <AdminGameProvider slug={game.slug}>
      <AdminShell games={switcherGames(games)} game={{ slug: game.slug, studioUrl: studio, counts }}>
        <PageHeader title={item.label} description={item.description} actions={monitoring ? <RefreshButton /> : undefined} />
        {body}
      </AdminShell>
    </AdminGameProvider>
  )
}
