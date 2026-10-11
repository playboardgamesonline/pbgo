import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { AdminShell, PageHeader } from "../components/admin/admin-shell"
import { LoginForm } from "../components/admin/login-form"
import { RefreshButton } from "../components/admin/refresh-button"
import { AudioPage } from "../components/admin/setup/audio"
import { CopyPage } from "../components/admin/setup/copy"
import { IdentityPage } from "../components/admin/setup/identity"
import { MechanicsPage } from "../components/admin/setup/mechanics"
import { VisualPage } from "../components/admin/setup/visual"
import { FeedbackList } from "../components/admin/tasks/feedback-list"
import { TaskBoard } from "../components/admin/tasks/task-board"
import { type AdminPath, adminHref, findAdminItem } from "../lib/admin-nav"
import type { GameEntry, PlayableGame } from "../lib/binding"
import { loadSettings } from "../lib/settings-server"
import { SITE_URL } from "../lib/site-url"
import { isProjectId } from "../sanity/env"
import { adminConfigured, isAdmin } from "../server/admin"
import { launchChecklist } from "../server/launch"
import { readAdminData } from "../server/settings"
import { supabaseAdmin } from "../server/supabase"
import { taskCounts } from "../server/tasks"
import { LaunchPage } from "./admin/launch"
import { AudiencePage, GamesPage, HealthPage } from "./admin/monitoring"

/** `generateMetadata` of `/<slug>/admin/[[...section]]`. */
export function adminMetadata(section: string[] | undefined): Metadata {
  const item = findAdminItem(section?.join("/") ?? "")
  return { title: item ? `${item.label} · Admin` : "Admin", robots: { index: false, follow: false } }
}

/** Sanity Studio of the game: `STUDIO_URL` of its binding, else the project's page on sanity.io. */
const studioUrl = (game: PlayableGame) =>
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
 * Admin of a game: `/<slug>/admin/<page>`. Setup (Identity, Mechanics, Visual, Audio, Copy), Tasks, Monitoring.
 * `games`: every game of the registry, listed by Monitoring › Health.
 */
export async function AdminPage({ game, section, games }: { game: PlayableGame; section: string[] | undefined; games: readonly GameEntry[] }) {
  const path = section?.join("/") ?? ""
  if (DEFAULTS[path]) redirect(adminHref(game.slug, DEFAULTS[path]))
  const item = findAdminItem(path)
  if (!item) notFound()

  const settings = await loadSettings(game)
  if (!(await isAdmin())) return <LoginForm title={settings.title} configured={adminConfigured()} />

  const needsData = !item.path.startsWith("monitoring/") && item.path !== "tasks/backlog" && item.path !== "tasks/bugs" && item.path !== "tasks/feedback"
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
      body = <IdentityPage initial={data!} domain={domain} />
      break
    case "mechanics":
      body = <MechanicsPage initial={data!} studioUrl={studio} />
      break
    case "visual":
      body = <VisualPage initial={data!} />
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
      body = <HealthPage game={game} games={games} settings={settings} supabaseOk={await supabaseOk(game.slug)} />
      break
  }

  return (
    <AdminShell title={settings.title} logo={settings.logo} favicon={settings.favicon} studioUrl={studio} counts={counts}>
      <PageHeader title={item.label} description={item.description} actions={item.path.startsWith("monitoring/") ? <RefreshButton /> : undefined} />
      {body}
    </AdminShell>
  )
}
