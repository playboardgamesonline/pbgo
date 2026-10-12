import type { Metadata, Viewport } from "next"
import { Toaster } from "@pbgo/ui/platform/sonner"
import { PLATFORM_THEME_COLOR } from "@pbgo/ui/theme"
import "./gamemaster.css"
import { PlatformDocument } from "@/components/platform-document"
import { SITE_URL } from "@/site"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Gamemaster", template: "%s · Gamemaster" },
  // Never indexed: this tag, the `X-Robots-Tag` header of next.config.ts and the `Disallow` of robots.ts say the same thing
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: PLATFORM_THEME_COLOR, colorScheme: "dark" }

/**
 * Root layout of the gamemaster (`/gamemaster/...`), the back office of every game. Platform look and no game runtime: it
 * edits any game of the registry, live or not, so it cannot sit inside a game's own layout (`app/[game]/layout.tsx`).
 */
export default function GamemasterLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <PlatformDocument>
      {children}
      <Toaster position="bottom-right" />
    </PlatformDocument>
  )
}
