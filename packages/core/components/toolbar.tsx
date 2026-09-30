"use client"

import { Menu09Icon, Scroll01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChevronDownIcon, CookieIcon, LanguagesIcon, ScaleIcon, SlidersHorizontalIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import { AUTHOR, CONTACT, type OptionValues } from "@pbgo/binding"
import type { RulesContent } from "../lib/rules"
import { LOCALES, LOCALE_NAMES } from "../lib/i18n"
import { FeedbackButton } from "./feedback"
import { GameSettingsDialog } from "./game-settings"
import { InfoDialog } from "./info-dialog"
import { setLocaleCookie } from "./language-select"
import { GameRulesButton as RulesButton } from "./rules-slot"
import { useSiteSettings } from "./settings-provider"
import { SoundButton } from "./sound/sound"
import { useSkin, useText } from "./skin-provider"
import { useRouter } from "next/navigation"

/** Boutons ronds fins : liseré discret, icône légère, léger relief au survol. */
const BADGE =
  "flex size-10 cursor-pointer items-center justify-center rounded-full border border-foreground/40 bg-black/25 text-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255/6%),0_2px_8px_rgb(0_0_0/35%)] backdrop-blur-sm transition-[transform,border-color,background-color] duration-200 hover:scale-105 hover:border-foreground/70 hover:bg-black/40 active:scale-95"
const ROW = "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/10"
const SEPARATOR = <div role="separator" className="my-1 h-px bg-foreground/15" />

/**
 * Deux boutons discrets : le son et un menu déroulant (langue, règles, paramètres de la partie · cookies, mentions légales · feedback).
 * Les fenêtres (règles, feedback) restent montées même menu fermé pour conserver leur état.
 */
export function Toolbar({ rules, gameCode, options, align = "left" }: { rules?: RulesContent; gameCode?: string; options?: OptionValues; align?: "left" | "right" }) {
  const t = useText()
  const { locale } = useSkin()
  const { credits } = useSiteSettings()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [languages, setLanguages] = useState(false)
  const [dialog, setDialog] = useState<"settings" | "cookies" | "legal" | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const rulesHost = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) return void (e.key === "Escape" && setOpen(false))
      const target = e.target as Element | null
      // les fenêtres (règles, feedback…) sont rendues hors du menu : cliquer dedans ne le referme pas
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
  const openDialog = (d: "settings" | "cookies" | "legal") => {
    setOpen(false)
    setDialog(d)
  }
  const openRules = () => {
    setOpen(false)
    rulesHost.current?.querySelector("button")?.click()
  }

  const label = open ? t("closeMenu") : t("menu")
  const legalText = t("legalBody", {
    publisher: credits.publisher ?? AUTHOR.name,
    authors: credits.authors ?? AUTHOR.name,
    contact: CONTACT,
  })
  const tab = open ? 0 : -1
  return (
    <div ref={root} className="relative flex items-center justify-center gap-2">
      <SoundButton className={BADGE} iconClass="size-[18px]" stroke={1.1} />
      <button type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} className={BADGE} onClick={() => setOpen((o) => !o)}>
        <HugeiconsIcon icon={Menu09Icon} strokeWidth={1.1} className="size-[18px]" />
      </button>
      <div ref={rulesHost} className="hidden" aria-hidden>
        {rules && <RulesButton rules={rules} />}
      </div>
      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          "absolute top-full z-50 mt-1 flex w-64 flex-col rounded-xl border border-foreground/15 bg-surface/95 p-1.5 text-foreground shadow-xl backdrop-blur-sm transition-opacity duration-200",
          align === "right" ? "right-0 origin-top-right" : "left-1/2 -translate-x-1/2 origin-top",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <button type="button" role="menuitem" tabIndex={tab} aria-expanded={languages} className={ROW} onClick={() => setLanguages((v) => !v)}>
          <LanguagesIcon strokeWidth={1.6} className="size-4.5" />
          <span className="flex-1">{t("language")}</span>
          <span className="text-xs font-bold text-foreground/60 uppercase">{locale}</span>
          <ChevronDownIcon strokeWidth={1.6} className={cn("size-4 text-foreground/50 transition-transform", languages && "rotate-180")} />
        </button>
        {languages && (
          <div className="flex items-center gap-1 px-2 pb-1.5" role="group" aria-label={t("language")}>
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                title={LOCALE_NAMES[l]}
                aria-pressed={l === locale}
                tabIndex={tab}
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
        )}
        {rules && (
          <button type="button" role="menuitem" tabIndex={tab} className={ROW} onClick={openRules}>
            <HugeiconsIcon icon={Scroll01Icon} strokeWidth={1.6} className="size-4.5" />
            {t("rulesTitle")}
          </button>
        )}
        {options && (
          <button type="button" role="menuitem" tabIndex={tab} className={ROW} onClick={() => openDialog("settings")}>
            <SlidersHorizontalIcon strokeWidth={1.6} className="size-4.5" />
            {t("gameSettingsMenu")}
          </button>
        )}
        {SEPARATOR}
        <button type="button" role="menuitem" tabIndex={tab} className={ROW} onClick={() => openDialog("cookies")}>
          <CookieIcon strokeWidth={1.6} className="size-4.5" />
          {t("cookiesMenu")}
        </button>
        <button type="button" role="menuitem" tabIndex={tab} className={ROW} onClick={() => openDialog("legal")}>
          <ScaleIcon strokeWidth={1.6} className="size-4.5" />
          {t("legalMenu")}
        </button>
        {SEPARATOR}
        <FeedbackButton gameCode={gameCode} asRow />
      </div>
      {options && <GameSettingsDialog open={dialog === "settings"} onOpenChange={(o) => setDialog(o ? "settings" : null)} options={options} />}
      <InfoDialog open={dialog === "cookies"} onOpenChange={(o) => setDialog(o ? "cookies" : null)} title={t("cookiesMenu")} text={t("cookiesBody")} />
      <InfoDialog open={dialog === "legal"} onOpenChange={(o) => setDialog(o ? "legal" : null)} title={t("legalMenu")} text={legalText} />
    </div>
  )
}
