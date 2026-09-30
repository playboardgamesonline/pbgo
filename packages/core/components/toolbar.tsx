"use client"

import { MenuIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import type { RulesContent } from "../lib/rules"
import { LOCALES, LOCALE_NAMES } from "../lib/i18n"
import { FeedbackButton } from "./feedback"
import { setLocaleCookie } from "./language-select"
import { GameRulesButton as RulesButton } from "./rules-slot"
import { ICON_BUTTON, SoundButton } from "./sound/sound"
import { useSkin, useText } from "./skin-provider"
import { useRouter } from "next/navigation"

/**
 * Menu des réglages : un seul bouton discret (à droite du logo, ou en haut à droite de l'accueil) qui déroule règles, son, feedback et langue.
 * Les boutons restent montés même menu fermé (masqués en fondu) : leurs fenêtres (règles, feedback) gardent ainsi leur état.
 */
export function Toolbar({ rules, gameCode, align = "left" }: { rules?: RulesContent; gameCode?: string; align?: "left" | "right" }) {
  const t = useText()
  const { locale } = useSkin()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) return void (e.key === "Escape" && setOpen(false))
      const target = e.target as Element | null
      // les fenêtres (règles, feedback) sont rendues hors du menu : cliquer dedans ne le referme pas
      if (!root.current?.contains(target) && !target?.closest?.("[role=dialog], [data-radix-popper-content-wrapper]")) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", close)
    }
  }, [open])

  const choose = (l: (typeof LOCALES)[number]) => {
    if (l === locale) return
    setLocaleCookie(l)
    document.documentElement.lang = l
    router.refresh()
  }

  const label = open ? t("closeMenu") : t("menu")
  return (
    <div ref={root} className="relative">
      <button type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} className={ICON_BUTTON} onClick={() => setOpen((o) => !o)}>
        {open ? <XIcon strokeWidth={1.6} className="size-6" /> : <MenuIcon strokeWidth={1.6} className="size-6" />}
      </button>
      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          "absolute top-full z-50 mt-1 flex w-max flex-col gap-2 rounded-xl border border-foreground/15 bg-surface/95 p-2 text-foreground shadow-xl backdrop-blur-sm transition-[opacity,transform] duration-200",
          align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <div className="flex items-center gap-1">
          {rules && <RulesButton rules={rules} />}
          <SoundButton />
          <FeedbackButton gameCode={gameCode} />
        </div>
        <div className="flex items-center gap-1 border-t border-foreground/15 pt-2" role="group" aria-label={t("language")}>
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              title={LOCALE_NAMES[l]}
              aria-pressed={l === locale}
              tabIndex={open ? 0 : -1}
              onClick={() => choose(l)}
              className={cn(
                "h-8 flex-1 cursor-pointer rounded-lg px-2 text-xs font-bold uppercase transition-colors",
                l === locale ? "bg-foreground/90 text-background" : "text-foreground/70 hover:bg-foreground/10 hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
