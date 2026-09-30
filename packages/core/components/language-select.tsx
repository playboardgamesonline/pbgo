"use client"

import { Globe02Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from "../lib/i18n"
import { ICON_BUTTON } from "./sound/sound"
import { useSkin, useText } from "./skin-provider"

/** Langue du visiteur : mémorisée dans un cookie d'un an (même URL pour tout le monde), la page est rendue à nouveau dans la nouvelle langue. */
export function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
}

export function LanguageSelect({ className }: { className?: string }) {
  const { locale } = useSkin()
  const t = useText()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", close)
    }
  }, [open])

  const choose = (l: Locale) => {
    setOpen(false)
    if (l === locale) return
    setLocaleCookie(l)
    document.documentElement.lang = l
    router.refresh()
  }

  return (
    <div ref={root} className="relative">
      <button type="button" aria-label={t("language")} title={t("language")} aria-haspopup="listbox" aria-expanded={open} className={cn(ICON_BUTTON, "relative", className)} onClick={() => setOpen((o) => !o)}>
        <HugeiconsIcon icon={Globe02Icon} strokeWidth={1.6} className="size-7" />
        <span className="absolute right-0 bottom-0.5 rounded bg-background/80 px-1 text-[9px] leading-tight font-bold text-foreground uppercase">{locale}</span>
      </button>
      {open && (
        <ul role="listbox" aria-label={t("language")} className="absolute top-full right-0 z-50 mt-2 min-w-40 overflow-hidden rounded-xl border border-foreground/15 bg-surface p-1 text-foreground shadow-xl">
          {LOCALES.map((l) => (
            <li key={l} role="option" aria-selected={l === locale}>
              <button type="button" lang={l} onClick={() => choose(l)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/10">
                <span className="flex-1">{LOCALE_NAMES[l]}</span>
                {l === locale && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
