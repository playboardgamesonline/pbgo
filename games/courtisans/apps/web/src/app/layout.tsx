import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "@fontsource-variable/alegreya"
import { AppShell } from "@pgo/core/components/app-shell"
import { Toaster } from "@pgo/ui/game/sonner"
import { TooltipProvider } from "@pgo/ui/game/tooltip"
import { fontFaceCss, googleFontsHref, themeStyle } from "@pgo/core/lib/settings"
import { loadSettings } from "@pgo/core/lib/settings-server"
import { loadSkin } from "@pgo/core/lib/skin-server"
import { AUTHOR, GOOGLE_SITE_VERIFICATION, KEYWORDS, SITE_URL } from "@/lib/site"
import "./globals.css"

// Police des annonces plein écran et des titres d'ambiance
const typey = localFont({
  src: [
    { path: "../fonts/typey.woff2", style: "normal" },
    { path: "../fonts/typey-italic.woff2", style: "italic" },
  ],
  variable: "--font-typey-file",
  display: "swap",
})

export async function generateMetadata(): Promise<Metadata> {
  const { title, description, logo } = await loadSettings()
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${title}` },
    description,
    applicationName: title,
    keywords: KEYWORDS,
    authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
    creator: AUTHOR.name,
    category: "games",
    alternates: { canonical: "/" },
    openGraph: { type: "website", locale: "fr_FR", url: "/", siteName: title, title, description, ...(logo ? { images: [logo] } : {}) },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    formatDetection: { telephone: false, email: false, address: false },
    verification: { google: GOOGLE_SITE_VERIFICATION },
  }
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await loadSettings()
  return { themeColor: theme.background, colorScheme: "dark" }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [settings, skin] = await Promise.all([loadSettings(), loadSkin()])
  const fonts = googleFontsHref([settings.files.fontBody ? null : settings.bodyFont, settings.files.fontDisplay ? null : settings.displayFont])
  const fontFaces = fontFaceCss(settings.files)
  return (
    <html lang="fr" className={`${typey.variable} h-full antialiased`} style={themeStyle(settings) as React.CSSProperties}>
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
        <AppShell settings={settings} skin={skin}>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </AppShell>
        <Toaster position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
