import type { Metadata, Viewport } from "next"
import { AnalyticsProvider } from "@pbgo/analytics/client"
import { Toaster } from "@pbgo/ui/platform/sonner"
import { PLATFORM_THEME_COLOR } from "@pbgo/ui/theme"
import "../globals.css"
import { DisplaySync } from "@/components/display-sync"
import { LanguageSync } from "@/components/language-sync"
import { PlatformDocument } from "@/components/platform-document"
import { PresenceBeat } from "@/components/presence-beat"
import { SearchSync } from "@/components/search-sync"
import { SiteHeader } from "@/components/site-header"
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/site"

// The hub's icon, `public/favicon.ico`, named in the head of every hub page: a search engine looks for it there. Google keeps an icon under its address and reads a changed file again only after days or weeks, so a replaced file gets a new `v`, which is a new address (and only then: Google asks for an address that stays).
const SITE_ICON = "/favicon.ico?v=2"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} · Board games online with friends or rivals`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  icons: { icon: SITE_ICON },
  openGraph: { type: "website", siteName: SITE_NAME, url: SITE_URL },
}

export const viewport: Viewport = { themeColor: PLATFORM_THEME_COLOR, colorScheme: "dark" }

/**
 * Root layout of the hub pages (`/`, `/games`, `/game/<slug>`, `/tables`, `/tournaments`, `/pricing`, `/about`, `/legal`, `/docs`).
 * Each game has its own root layout, `app/[game]/layout.tsx`.
 * The analytics are mounted here and not in `PlatformDocument`, which the gamemaster uses too: it never reports. So is the navbar
 * (`SiteHeader`): mounted once, it stays from one page to the next, and it draws nothing on the pages that have none (the sign-in and the sign-up,
 * which are a page of their own, the pages of a doc, which have a side menu of their own, the legal pages, the 404). `LanguageSync` and `DisplaySync` are mounted once too: they keep the device of a signed-in visitor in the language, the motion and the transparency of their account. So is `PresenceBeat`, which tells the server that a signed-in member has the site open (the players online), and `SearchSync`, which keeps the search of a visitor who pressed Play alive and takes them to the table that begins. So is the toaster, which says what went wrong when a table could not be opened, joined or started.
 * `modal` is the window that a link of the site opens over the page the visitor is on (the settings: `@modal`).
 */
export default function HubLayout({ children, modal }: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <PlatformDocument>
      <SiteHeader />
      <LanguageSync />
      <DisplaySync />
      <PresenceBeat />
      <SearchSync />
      {children}
      {modal}
      <Toaster />
      <AnalyticsProvider />
    </PlatformDocument>
  )
}
