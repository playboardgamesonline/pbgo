import type { Metadata } from "next"
import { AdminShell } from "../components/admin/admin-shell"
import { LoginForm } from "../components/admin/login-form"
import { SettingsForm } from "../components/admin/settings-form"
import { SetupTabs } from "../components/admin/setup-tabs"
import { TaskList } from "../components/admin/task-list"
import { PLAYER_BOUNDS, type SiteSettings } from "../lib/settings"
import { loadSettings } from "../lib/settings-server"
import { sanityConfigure } from "../sanity/client"
import { sanityWritable } from "../sanity/write-client"
import { adminConfigured, isAdmin } from "../server/admin"
import { readSettingsFresh } from "../server/settings"

export const metadata: Metadata = { title: "Setup", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const settings = await loadSettings()
  if (!(await isAdmin())) return <LoginForm title={settings.title} configured={adminConfigured()} />
  const { tab } = await searchParams
  const initial: SiteSettings = sanityWritable ? await readSettingsFresh().catch(() => settings) : settings
  return (
    <AdminShell title={settings.title} logo={settings.logo}>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
        <p className="text-muted-foreground">Paramètres du site et prochaines étapes du projet.</p>
      </div>
      <SetupTabs
        initial={tab === "todo" ? "todo" : "settings"}
        settings={<SettingsForm initial={initial} meta={{ writable: sanityWritable, sanityConfigured: sanityConfigure, bounds: PLAYER_BOUNDS }} />}
        todo={<TaskList />}
      />
    </AdminShell>
  )
}
