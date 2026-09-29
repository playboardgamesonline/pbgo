import type { MetadataRoute } from "next"
import { loadSettings } from "@pgo/core/lib/settings-server"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { title, description, theme } = await loadSettings()
  return {
    name: title,
    short_name: title,
    description,
    start_url: "/",
    display: "standalone",
    background_color: theme.background,
    theme_color: theme.background,
    lang: "fr",
  }
}
