import * as binding from "@pgo/binding"
import { SITE_URL } from "@pgo/binding"
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
import { type AdminPath, findAdminItem } from "../lib/admin-nav"
import { loadSettings } from "../lib/settings-server"
import { projectId } from "../sanity/env"
import { adminConfigured, isAdmin } from "../server/admin"
import { launchChecklist } from "../server/launch"
import { readAdminData } from "../server/settings"
import { supabaseAdmin } from "../server/supabase"
import { taskCounts } from "../server/tasks"
import { LaunchPage } from "./admin/launch"
import { AudiencePage, GamesPage, HealthPage } from "./admin/monitoring"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ section?: string[] }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = findAdminItem((await params).section?.join("/") ?? "")
  return { title: item ? `${item.label} · Admin` : "Admin", robots: { index: false, follow: false } }
}

/** Studio Sanity du jeu : NEXT_PUBLIC_SANITY_STUDIO_URL, sinon `STUDIO_URL` de @pgo/binding, sinon la page du projet sur sanity.io. */
const studioUrl =
  process.env.NEXT_PUBLIC_SANITY_STUDIO_URL ??
  (binding as { STUDIO_URL?: string }).STUDIO_URL ??
  (projectId.startsWith("__") ? null : `https://www.sanity.io/manage/project/${projectId}`)

const DEFAULTS: Record<string, AdminPath> = { "": "identity", tasks: "tasks/launch", monitoring: "monitoring/games" }

async function supabaseOk() {
  try {
    const { error } = await supabaseAdmin().from("games").select("code", { count: "exact", head: true })
    return !error
  } catch {
    return false
  }
}

/** Admin du site : /admin/<page>. Setup (Identity, Mechanics, Visual, Audio, Copy), Tasks, Monitoring. */
export default async function AdminPage({ params }: Params) {
  const path = (await params).section?.join("/") ?? ""
  if (DEFAULTS[path]) redirect(`/admin/${DEFAULTS[path]}`)
  const item = findAdminItem(path)
  if (!item) notFound()

  const settings = await loadSettings()
  if (!(await isAdmin())) return <LoginForm title={settings.title} configured={adminConfigured()} />

  const needsData = !item.path.startsWith("monitoring/") && item.path !== "tasks/backlog" && item.path !== "tasks/bugs" && item.path !== "tasks/feedback"
  const [data, counts] = await Promise.all([needsData ? readAdminData() : null, taskCounts().catch(() => ({ backlog: null, bugs: null, feedback: null }))])
  const launch = data && item.path === "tasks/launch" ? await launchChecklist(data) : null
  const domain = (() => {
    try {
      return new URL(SITE_URL).hostname
    } catch {
      return "localhost"
    }
  })()

  let body: React.ReactNode
  switch (item.path) {
    case "identity":
      body = <IdentityPage initial={data!} domain={domain} />
      break
    case "mechanics":
      body = <MechanicsPage initial={data!} studioUrl={studioUrl} />
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
      body = <LaunchPage items={launch!} />
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
      body = <GamesPage />
      break
    case "monitoring/audience":
      body = <AudiencePage />
      break
    case "monitoring/health":
      body = <HealthPage settings={settings} supabaseOk={await supabaseOk()} />
      break
  }

  return (
    <AdminShell title={settings.title} logo={settings.logo} favicon={settings.favicon} studioUrl={studioUrl} counts={counts}>
      <PageHeader title={item.label} description={item.description} actions={item.path.startsWith("monitoring/") ? <RefreshButton /> : undefined} />
      {body}
    </AdminShell>
  )
}
