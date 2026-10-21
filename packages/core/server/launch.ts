import "server-only"
import type { AdminPath } from "../lib/admin-nav"
import type { GameModule } from "../lib/binding"
import { missingTexts } from "../lib/missing"
import { defaultTheme } from "../lib/settings"
import { SITE_URL } from "../lib/site-url"
import { sanityConfigured } from "../sanity/client"
import { sanityWritable, writeTokenName } from "../sanity/write-client"
import { adminConfigured } from "./admin"
import type { AdminData } from "./settings"
import { supabaseAdmin } from "./supabase"
import { loadWebAnalytics } from "./vercel"

export type LaunchItem = { id: string; group: string; label: string; detail: string; ok: boolean; optional?: boolean; fix: AdminPath }

async function supabaseState(slug: string) {
  try {
    const db = supabaseAdmin()
    const [games, tasks, feedback, bugs] = await Promise.all([
      db.from("games").select("code", { count: "exact", head: true }).eq("game", slug),
      db.from("tasks").select("type", { count: "exact", head: true }).eq("game", slug),
      db.from("feedback").select("id", { count: "exact", head: true }).eq("game", slug),
      db.from("tasks").select("id", { count: "exact", head: true }).eq("game", slug).eq("type", "bug").eq("priority", "high").eq("done", false),
    ])
    return { games: !games.error, migrated: !tasks.error && !feedback.error, criticalBugs: bugs.error ? 0 : (bugs.count ?? 0) }
  } catch {
    return { games: false, migrated: false, criticalBugs: 0 }
  }
}

/** Pre-launch checklist of one game, checked against the real state of the site on every display. */
export async function launchChecklist(game: GameModule, data: AdminData): Promise<LaunchItem[]> {
  const { settings, visual, audio, skin } = data
  const [db, analytics] = await Promise.all([supabaseState(game.slug), loadWebAnalytics()])
  const customTheme = JSON.stringify(settings.theme) !== JSON.stringify(defaultTheme(game.binding))
  const writable = sanityWritable(game)
  const declaredSounds = audio.effects.length
  const missingSounds = audio.effects.filter((e) => !e.url).length
  const gaps = missingTexts(data.copy, settings.descriptions)
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
    { id: "favicon", group: "Identity", label: "Favicon", detail: settings.favicon ? "Uploaded" : "Generated from the logo for now", ok: !!settings.favicon, optional: true, fix: "identity" },
    { id: "share", group: "Identity", label: "Share image", detail: settings.shareImage ? "Custom image" : "Generated from the visual identity", ok: !!settings.shareImage || !!settings.logo || !!skin.decor.top, fix: "identity" },
    { id: "rules", group: "Mechanics", label: "Rules PDF (French)", detail: "Linked from the menu (Rules)", ok: !!settings.rulesPdf.fr, fix: "mechanics" },
    { id: "theme", group: "Visual", label: "Colors", detail: "Theme changed from the template defaults", ok: customTheme, fix: "visual" },
    { id: "decor", group: "Visual", label: "Decorations", detail: "Top and bottom decorations of the home screen", ok: !!visual.images.decorTop.url && !!visual.images.decorBottom.url, fix: "visual" },
    { id: "sounds", group: "Audio", label: "Sounds in Sanity", detail: !declaredSounds ? "The game declares no sound effects" : missingSounds ? `${missingSounds} of ${declaredSounds} effects have no file in Sanity` : "Every effect has a file in Sanity", ok: missingSounds === 0, optional: true, fix: "audio" },
    { id: "content", group: "Content", label: "Game texts in Sanity", detail: gaps.length ? `Not in Sanity yet: ${gaps.slice(0, 4).join(", ")}${gaps.length > 4 ? `, and ${gaps.length - 4} more` : ""}` : "Every required text is in Sanity, in every language", ok: !gaps.length, fix: "copy" },
    { id: "admin", group: "Services", label: "Gamemaster account", detail: "ADMIN_LOGIN, ADMIN_PASSWORD and ADMIN_SESSION_SECRET", ok: adminConfigured(), fix: "monitoring/health" },
    { id: "sanity", group: "Services", label: "Sanity", detail: writable ? "Connected, the admin can save" : sanityConfigured(game) ? `${writeTokenName(game.slug)} missing` : "No Sanity project in the registry", ok: writable, fix: "monitoring/health" },
    { id: "supabase", group: "Services", label: "Supabase", detail: "Games table reachable", ok: db.games, fix: "monitoring/health" },
    { id: "migration", group: "Services", label: "Tasks & feedback tables", detail: "Migration supabase/migrations/0001_init.sql applied", ok: db.migrated, fix: "tasks/feedback" },
    { id: "analytics", group: "Services", label: "Web Analytics", detail: "Enabled on Vercel, with VERCEL_TOKEN", ok: !!analytics && !("error" in analytics), optional: true, fix: "monitoring/audience" },
    { id: "domain", group: "Services", label: "Domain", detail: host || "NEXT_PUBLIC_SITE_URL", ok: !!host && !host.endsWith(".vercel.app") && host !== "localhost", optional: true, fix: "monitoring/health" },
    { id: "live", group: "Services", label: "Live in the registry", detail: game.live ? (game.indexable ? "Live and indexed" : "Live, not indexed yet") : "Set live: true in packages/games", ok: game.live, fix: "monitoring/health" },
    { id: "bugs", group: "Quality", label: "No critical bug open", detail: db.criticalBugs ? `${db.criticalBugs} critical bug${db.criticalBugs > 1 ? "s" : ""}` : "Nothing critical", ok: db.criticalBugs === 0, fix: "tasks/bugs" },
  ]
}
