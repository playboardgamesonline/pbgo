"use client"

import { MonitorIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { useSkin, useText } from "./skin-provider"

/** Game pages (lobby, board) and their admin preview, `/<slug>/game/…` and `/<slug>/preview/game`: the only ones the wall covers. */
const GAME_PAGES = /^\/[^/]+\/(game|preview\/game)(\/|$)/

/**
 * Below 900 px, covers the game pages when the skin asks for it (`interface.desktopOnly`, true by default).
 * The home page, the rules and the rest of the site stay readable on mobile (search engines): see `DesktopNotice`.
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

/** Non-blocking notice below 900 px (home page): the page can be read, but the game is played on a computer (the form is hidden). */
export function DesktopNotice() {
  const { desktopOnly } = useSkin()
  const t = useText()
  if (!desktopOnly) return null
  return (
    <p className="mx-4 mt-[2.5vh] flex max-w-sm shrink-0 items-center gap-3 rounded-xl border border-foreground/25 bg-surface-dark/70 px-4 py-3 text-left text-sm leading-snug text-foreground/85 min-[900px]:hidden">
      <MonitorIcon aria-hidden className="size-6 shrink-0 text-foreground/80" strokeWidth={1.4} />
      <span>{t("desktopOnly")}</span>
    </p>
  )
}
