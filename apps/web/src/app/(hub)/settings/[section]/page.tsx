import { redirect } from "next/navigation"
import { SETTINGS_PATH } from "@/lib/settings-paths"

/**
 * `/settings/<section>`, the address that the settings have over the screen of a game (`GAME_SETTINGS_PATH`, `app/[game]/@modal/(...)settings`): the window there is drawn by the game's layout, which a link of the hub's own address cannot reach. A link followed from a
 * board never gets here, the games' window answers it first. This is the page that an interception needs at its address, and what a typed address, a reload or a visitor with no script finds: it leads to the settings' own page.
 */
export default async function SettingsAliasPage({ params }: { params: Promise<{ section: string }> }) {
  redirect(`${SETTINGS_PATH}/${encodeURIComponent((await params).section)}`)
}
