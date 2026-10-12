import type { Metadata, Viewport } from "next"
import { PLATFORM_THEME_COLOR } from "@pbgo/ui/theme"
import "../globals.css"
import { PlatformDocument } from "@/components/platform-document"
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/site"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} · Board games online with friends`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, url: SITE_URL },
}

export const viewport: Viewport = { themeColor: PLATFORM_THEME_COLOR, colorScheme: "dark" }

/** Root layout of the hub pages (`/`, `/legal`, `/design`). Each game has its own root layout, `app/[game]/layout.tsx`. */
export default function HubLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PlatformDocument>{children}</PlatformDocument>
}
