"use client"

import { MonitorIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { useSkin, useText } from "./skin-provider"

/**
 * Game pages (the board) and their admin preview, `/<slug>/game/…` and `/<slug>/preview/game` (shown by the gamemaster as
 * `/gamemaster/<slug>/preview/game`): the only ones the wall covers.
 */
const GAME_PAGES = /^(?:\/[^/]+\/(?:game|preview\/game)|\/gamemaster\/[^/]+\/preview\/game)(\/|$)/

/**
 * Below 900 px, covers the game pages when the skin asks for it (`interface.desktopOnly`, true by default).
 * The hub, with the page of the game where a table is opened, the rules and the rest of the site are not covered: they stay readable on mobile (search engines).
 */
export function DesktopOnly() {
  const { desktopOnly, decor } = useSkin()
  const t = useText()
  const pathname = usePathname()
  if (!desktopOnly || !GAME_PAGES.test(pathname ?? "")) return null
  return (
    <div className="fixed inset-0 z-[100] hidden flex-col items-center justify-center gap-5 bg-background px-8 text-center max-[899px]:flex">
      {decor.pattern && (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[length:128px_128px] opacity-[0.07]" style={{ backgroundImage: `url(${decor.pattern})` }} />
      )}
      <MonitorIcon className="relative size-12 text-foreground/80" strokeWidth={1.4} />
      <p className="relative max-w-sm font-display text-lg leading-snug text-balance text-foreground/85">{t("desktopOnly")}</p>
    </div>
  )
}
