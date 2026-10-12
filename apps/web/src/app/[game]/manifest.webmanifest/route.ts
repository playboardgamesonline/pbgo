import type { MetadataRoute } from "next"
import { getLocale } from "@pbgo/core/lib/locale-server"
import { siteTitle } from "@pbgo/core/lib/settings"
import { loadSettings } from "@pbgo/core/lib/settings-server"
import { getGame } from "@pbgo/games"

// One manifest per game (the manifest.ts convention only exists at the root of app/); linked from the [game] layout's metadata
export async function GET(_request: Request, { params }: RouteContext<"/[game]/manifest.webmanifest">) {
  const game = await getGame((await params).game)
  if (!game) return new Response(null, { status: 404 })
  const [{ title, description, theme }, locale] = await Promise.all([loadSettings(game), getLocale()])
  const manifest: MetadataRoute.Manifest = {
    name: siteTitle(title),
    short_name: title,
    description,
    start_url: `/${game.slug}`,
    scope: `/${game.slug}`,
    display: "standalone",
    background_color: theme.background,
    theme_color: theme.background,
    lang: locale,
    icons: [
      { src: `/${game.slug}/icons/favicon`, sizes: "64x64", type: "image/png" },
      { src: `/${game.slug}/icons/apple`, sizes: "180x180", type: "image/png" },
    ],
  }
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } })
}
