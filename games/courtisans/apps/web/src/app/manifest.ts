import type { MetadataRoute } from "next"
import { loadSettings } from "@pgo/core/lib/settings-server"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { title, description, theme } = await loadSettings()
  return {
    name: title,
    short_name: "Courtisans",
    description,
    start_url: "/",
    display: "standalone",
    background_color: theme.background,
    theme_color: theme.background,
    lang: "fr",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
