import "@fontsource-variable/geist-mono"
import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { AppShell } from "@pbgo/core/components/app-shell"
import { AppToaster } from "@pbgo/core/components/toaster"
import { loadAudio } from "@pbgo/core/lib/audio-server"
import { OG_LOCALES } from "@pbgo/core/lib/i18n"
import { getLocale } from "@pbgo/core/lib/locale-server"
import { fontFaceCss, googleFontsHref, siteTitle, themeStyle } from "@pbgo/core/lib/settings"
import { loadSettings } from "@pbgo/core/lib/settings-server"
import { gameUrl, SITE_URL } from "@pbgo/core/lib/site-url"
import { loadSkin } from "@pbgo/core/lib/skin-server"
import { GameRuntime } from "@pbgo/games/runtime"
import { TooltipProvider } from "@pbgo/ui/game/tooltip"
import { gameOf } from "@/lib/game"

export async function generateMetadata({ params }: LayoutProps<"/[game]">): Promise<Metadata> {
  const game = await gameOf(params)
  const [settings, locale] = await Promise.all([loadSettings(game), getLocale()])
  const { AUTHOR, GOOGLE_SITE_VERIFICATION, KEYWORDS } = game.binding
  const { description } = settings
  const title = siteTitle(settings.title)
  const url = gameUrl(game.slug)
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${title}` },
    description,
    applicationName: title,
    keywords: KEYWORDS && [...KEYWORDS],
    authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
    creator: AUTHOR.name,
    category: "games",
    alternates: { canonical: url },
    openGraph: { type: "website", locale: OG_LOCALES[locale], url, siteName: title, title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: game.indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } }
      : { index: false, follow: false },
    formatDetection: { telephone: false, email: false, address: false },
    verification: GOOGLE_SITE_VERIFICATION ? { google: GOOGLE_SITE_VERIFICATION } : undefined,
    icons: {
      icon: [{ url: `/${game.slug}/icons/favicon`, type: "image/png", sizes: "64x64" }],
      apple: [{ url: `/${game.slug}/icons/apple`, type: "image/png", sizes: "180x180" }],
    },
    manifest: `/${game.slug}/manifest.webmanifest`,
  }
}

export async function generateViewport({ params }: LayoutProps<"/[game]">): Promise<Viewport> {
  const { theme } = await loadSettings(await gameOf(params))
  return { themeColor: theme.background, colorScheme: "dark" }
}

/**
 * Root layout of a game's pages (`/<slug>/...`): its theme and fonts (admin › Visual), its client runtime (styles,
 * binding: only this game's code is loaded) and the shared shell (sound, toolbar, small screens).
 */
export default async function GameLayout({ children, params }: LayoutProps<"/[game]">) {
  const game = await gameOf(params)
  const [settings, skin, sounds] = await Promise.all([loadSettings(game), loadSkin(game), loadAudio(game)])
  const fonts = googleFontsHref([settings.files.fontBody ? null : settings.bodyFont, settings.files.fontDisplay ? null : settings.displayFont])
  const fontFaces = fontFaceCss(settings.files)
  return (
    <html lang={skin.locale} className="h-full antialiased" style={themeStyle(settings) as React.CSSProperties}>
      <head>
        {fontFaces && <style dangerouslySetInnerHTML={{ __html: fontFaces }} />}
        {fonts && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href={fonts} />
          </>
        )}
      </head>
      <body className="flex min-h-full flex-col bg-background">
        <GameRuntime slug={game.slug}>
          <AppShell settings={settings} skin={skin} sounds={sounds}>
            <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          </AppShell>
          <AppToaster />
        </GameRuntime>
        <Analytics />
      </body>
    </html>
  )
}
