import type { MetadataRoute } from "next"
import { siteTitle } from "@pbgo/core/lib/settings"
import { getLocale } from "@pbgo/core/lib/locale-server"
import { loadSettings } from "@pbgo/core/lib/settings-server"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [{ title, description, theme }, locale] = await Promise.all([loadSettings(), getLocale()])
  return {
    name: siteTitle(title),
    short_name: "Courtisans",
    description,
    start_url: "/",
    display: "standalone",
    background_color: theme.background,
    theme_color: theme.background,
    lang: locale,
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
