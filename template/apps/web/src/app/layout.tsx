import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import "@fontsource-variable/geist-mono"
import { AppShell } from "@pbgo/core/components/app-shell"
import { AppToaster } from "@pbgo/core/components/toaster"
import { TooltipProvider } from "@pbgo/ui/game/tooltip"
import { fontFaceCss, googleFontsHref, siteTitle, themeStyle } from "@pbgo/core/lib/settings"
import { OG_LOCALES } from "@pbgo/core/lib/i18n"
import { getLocale } from "@pbgo/core/lib/locale-server"
import { loadSettings } from "@pbgo/core/lib/settings-server"
import { loadSkin } from "@pbgo/core/lib/skin-server"
import { loadAudio } from "@pbgo/core/lib/audio-server"
import { createRobotsMeta } from "@pbgo/site"
import { withBase } from "@pbgo/core/lib/base-path"
import { AUTHOR, INDEXABLE, GAME_URL, KEYWORDS } from "@/lib/site"
import "./globals.css"

export async function generateMetadata(): Promise<Metadata> {
  const [settings, locale] = await Promise.all([loadSettings(), getLocale()])
  const { description } = settings
  const title = siteTitle(settings.title)
  return {
    metadataBase: new URL(`${GAME_URL}/`),
    title: { default: title, template: `%s · ${title}` },
    description,
    applicationName: title,
    keywords: KEYWORDS,
    authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
    creator: AUTHOR.name,
    category: "games",
    alternates: { canonical: GAME_URL },
    openGraph: { type: "website", locale: OG_LOCALES[locale], url: GAME_URL, siteName: title, title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: createRobotsMeta(INDEXABLE),
    // Explicit so the links carry the base path (see app/icons/favicon/route.ts)
    icons: { icon: [{ url: withBase("/icons/favicon"), type: "image/png", sizes: "64x64" }], apple: [{ url: withBase("/icons/apple"), type: "image/png", sizes: "180x180" }] },
    formatDetection: { telephone: false, email: false, address: false },
  }
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await loadSettings()
  return { themeColor: theme.background, colorScheme: "dark" }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [settings, skin, sounds] = await Promise.all([loadSettings(), loadSkin(), loadAudio()])
  const locale = skin.locale
  const fonts = googleFontsHref([settings.files.fontBody ? null : settings.bodyFont, settings.files.fontDisplay ? null : settings.displayFont])
  const fontFaces = fontFaceCss(settings.files)
  return (
    <html lang={locale} className="h-full antialiased" style={themeStyle(settings) as React.CSSProperties}>
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
        <AppShell settings={settings} skin={skin} sounds={sounds}>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </AppShell>
        <AppToaster />
        <Analytics />
      </body>
    </html>
  )
}
