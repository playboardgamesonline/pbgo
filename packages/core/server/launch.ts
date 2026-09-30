import "server-only"
import { SITE_URL } from "@pbgo/binding"
import { DEFAULT_THEME } from "../lib/settings"
import type { AdminPath } from "../lib/admin-nav"
import { sanityConfigure } from "../sanity/client"
import { sanityWritable } from "../sanity/write-client"
import { adminConfigured } from "./admin"
import type { AdminData } from "./settings"
import { supabaseAdmin } from "./supabase"
import { loadWebAnalytics } from "./vercel"

export type LaunchItem = { id: string; group: string; label: string; detail: string; ok: boolean; optional?: boolean; fix: AdminPath }

async function supabaseState() {
  try {
    const db = supabaseAdmin()
    const [games, tasks, feedback, bugs] = await Promise.all([
      db.from("games").select("code", { count: "exact", head: true }),
      db.from("tasks").select("type", { count: "exact", head: true }),
      db.from("feedback").select("id", { count: "exact", head: true }),
      db.from("tasks").select("id", { count: "exact", head: true }).eq("type", "bug").eq("priority", "high").eq("done", false),
    ])
    return { games: !games.error, migrated: !tasks.error && !feedback.error, criticalBugs: bugs.error ? 0 : (bugs.count ?? 0) }
  } catch {
    return { games: false, migrated: false, criticalBugs: 0 }
  }
}

/** Liste « avant la mise en ligne », vérifiée à chaque affichage à partir de l'état réel du site. */
export async function launchChecklist(data: AdminData): Promise<LaunchItem[]> {
  const { settings, visual, audio, skin } = data
  const [db, analytics] = await Promise.all([supabaseState(), loadWebAnalytics()])
  const customTheme = JSON.stringify(settings.theme) !== JSON.stringify(DEFAULT_THEME)
  const host = (() => {
    try {
      return new URL(SITE_URL).hostname
    } catch {
      return ""
    }
  })()
  return [
    { id: "title", group: "Identity", label: "Title and description", detail: "A description of at least 80 characters for Google and share cards", ok: !!settings.title && settings.description.length >= 80, fix: "identity" },
    { id: "logo", group: "Identity", label: "Logo", detail: "Shown on every screen and in the share image", ok: !!settings.logo, fix: "identity" },
    { id: "favicon", group: "Identity", label: "Favicon", detail: settings.favicon?.startsWith("https://") ? "Uploaded" : settings.favicon ? "Default from the game code" : "Generated from the logo for now", ok: !!settings.favicon, optional: true, fix: "identity" },
    { id: "share", group: "Identity", label: "Share image", detail: settings.shareImage ? "Custom image" : "Generated from the visual identity", ok: !!settings.shareImage || !!settings.logo || !!skin.decor.top, fix: "identity" },
    { id: "rules", group: "Mechanics", label: "Rules PDF (French)", detail: "Linked from the rules window", ok: !!settings.rulesPdf.fr, fix: "mechanics" },
    { id: "theme", group: "Visual", label: "Colors", detail: "Theme changed from the template defaults", ok: customTheme, fix: "visual" },
    { id: "decor", group: "Visual", label: "Decorations", detail: "Top and bottom decorations of the home screen", ok: !!visual.images.decorTop.url && !!visual.images.decorBottom.url, fix: "visual" },
    { id: "sounds", group: "Audio", label: "Sounds in Sanity", detail: audio.pendingImport ? `${audio.pendingImport} still served from the code` : "Everything can be replaced from the admin", ok: audio.pendingImport === 0, optional: true, fix: "audio" },
    { id: "admin", group: "Services", label: "Admin password", detail: "ADMIN_LOGIN and ADMIN_PASSWORD", ok: adminConfigured(), fix: "monitoring/health" },
    { id: "sanity", group: "Services", label: "Sanity", detail: sanityWritable ? "Connected, the admin can save" : sanityConfigure ? "SANITY_API_WRITE_TOKEN missing" : "Project not configured", ok: sanityWritable, fix: "monitoring/health" },
    { id: "supabase", group: "Services", label: "Supabase", detail: "Games table reachable", ok: db.games, fix: "monitoring/health" },
    { id: "migration", group: "Services", label: "Tasks & feedback tables", detail: "Migration …_admin_tasks_feedback.sql applied", ok: db.migrated, fix: "tasks/feedback" },
    { id: "analytics", group: "Services", label: "Web Analytics", detail: "Enabled on Vercel, with VERCEL_TOKEN", ok: !!analytics && !("error" in analytics), optional: true, fix: "monitoring/audience" },
    { id: "domain", group: "Services", label: "Domain", detail: host || "SITE_URL", ok: !!host && !host.endsWith(".vercel.app") && host !== "localhost", optional: true, fix: "monitoring/health" },
    { id: "bugs", group: "Quality", label: "No critical bug open", detail: db.criticalBugs ? `${db.criticalBugs} critical bug${db.criticalBugs > 1 ? "s" : ""}` : "Nothing critical", ok: db.criticalBugs === 0, fix: "tasks/bugs" },
  ]
}
