import type { MetadataRoute } from "next"
import { getLocale } from "@pbgo/core/lib/locale-server"
import { loadSettings } from "@pbgo/core/lib/settings-server"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [{ title, description, theme }, locale] = await Promise.all([loadSettings(), getLocale()])
  return {
    name: title,
    short_name: title,
    description,
    start_url: "/",
    display: "standalone",
    background_color: theme.background,
    theme_color: theme.background,
    lang: locale,
  }
}
