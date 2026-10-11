import type { Metadata } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SITE_NAME } from "@/site"

export const metadata: Metadata = { title: `Page not found · ${SITE_NAME}`, robots: { index: false, follow: false } }

/**
 * 404 of the whole site (`experimental.globalNotFound`): the hub and the games have separate root layouts, so there is
 * no shared layout to render a not-found page in. Also served for an unknown game slug.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning className={cn("antialiased", GeistSans.variable, GeistMono.variable, "font-sans")}>
      <body>
        <ThemeProvider>
          <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
            <p className="text-sm text-muted-foreground">404</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Page not found</h1>
            <p className="max-w-md text-muted-foreground">This page does not exist, or the game is not here.</p>
            <Button asChild>
              <a href="/">All games</a>
            </Button>
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
