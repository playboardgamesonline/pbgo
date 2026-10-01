"use client"

import { Menu09Icon, Scroll01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { CookieIcon, LanguagesIcon, ScaleIcon, SlidersHorizontalIcon, SquareArrowOutUpRightIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import { AUTHOR, CONTACT, type OptionValues } from "@pbgo/binding"
import { LOCALES } from "../lib/i18n"
import { FeedbackButton } from "./feedback"
import { GameSettingsDialog } from "./game-settings"
import { InfoDialog } from "./info-dialog"
import { setLocaleCookie } from "./language-select"
import { useSiteSettings } from "./settings-provider"
import { SoundButton, SoundPanel } from "./sound/sound"
import { useSkin, useText } from "./skin-provider"
import { useRouter } from "next/navigation"

/** Traits d'1 px partout : le liseré du cercle et les icônes (vector-effect) ont exactement la même épaisseur. Ni fond, ni dégradé. */
const HAIRLINE = "[&_svg_*]:[vector-effect:non-scaling-stroke]"
const BADGE = `flex size-10 cursor-pointer items-center justify-center rounded-full border border-foreground/70 bg-transparent text-foreground drop-shadow-none transition-[transform,border-color] duration-200 hover:scale-105 hover:border-foreground active:scale-95 ${HAIRLINE}`
const ROW = `flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/10 ${HAIRLINE}`
const SEPARATOR = <div role="separator" className="my-1 h-px bg-foreground/15" />

/**
 * Deux boutons discrets : le son et un menu déroulant (langue, règles [lien externe], paramètres de la partie · cookies, mentions légales · feedback).
 * Les fenêtres (feedback, paramètres…) restent montées même menu fermé pour conserver leur état.
 */
export function Toolbar({ gameCode, options, align = "left" }: { gameCode?: string; options?: OptionValues; align?: "left" | "right" }) {
  const t = useText()
  const { locale } = useSkin()
  const { credits, rulesPdf } = useSiteSettings()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [soundOpen, setSoundOpen] = useState(false)
  const [dialog, setDialog] = useState<"settings" | "cookies" | "legal" | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open && !soundOpen) return
    const hide = () => {
      setOpen(false)
      setSoundOpen(false)
    }
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) return void (e.key === "Escape" && hide())
      const target = e.target as Element | null
      // les fenêtres (règles, feedback…) sont rendues hors du menu : cliquer dedans ne le referme pas
      if (!root.current?.contains(target) && !target?.closest?.("[role=dialog], [data-radix-popper-content-wrapper]")) hide()
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", close)
    }
  }, [open, soundOpen])

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
  // règles : lien vers le PDF de la langue du joueur ; à défaut la version anglaise, puis la première disponible
  const rulesUrl = [locale, "en" as const, ...LOCALES].map((l) => rulesPdf[l]).find((u): u is string => !!u) ?? null

  const label = open ? t("closeMenu") : t("menu")
  const legalText = t("legalBody", {
    publisher: credits.publisher ?? AUTHOR.name,
    authors: credits.authors ?? AUTHOR.name,
    contact: CONTACT,
  })
  const tab = open ? 0 : -1
  return (
    <div ref={root} className="relative flex items-center justify-center gap-2">
      <SoundButton
        className={BADGE}
        iconClass="size-[18px]"
        stroke={1}
        open={soundOpen}
        onClick={() => {
          setSoundOpen((o) => !o)
          setOpen(false)
        }}
      />
      <button type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} className={BADGE} onClick={() => {
          setOpen((o) => !o)
          setSoundOpen(false)
        }}>
        <HugeiconsIcon icon={Menu09Icon} strokeWidth={1} className="size-[18px]" />
      </button>
      <SoundPanel open={soundOpen} className="left-0 origin-top-left" />
      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          "absolute top-full z-50 mt-1 flex w-64 flex-col rounded-xl border border-foreground/15 bg-surface/95 p-1.5 text-foreground shadow-xl backdrop-blur-sm transition-opacity duration-200",
          align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <label className={cn(ROW, "cursor-default hover:bg-transparent")}>
          <LanguagesIcon strokeWidth={1} className="size-4.5" />
          <span className="flex-1">{t("language")}</span>
          <select
            value={locale}
            tabIndex={tab}
            aria-label={t("language")}
            onChange={(e) => choose(e.target.value as (typeof LOCALES)[number])}
            className="cursor-pointer rounded-md border border-foreground/40 bg-transparent py-1 pr-1 pl-2 text-xs font-semibold outline-none hover:border-foreground/70 focus-visible:border-foreground"
          >
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l} className="bg-surface text-foreground">
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        {rulesUrl && (
          <a href={rulesUrl} target="_blank" rel="noopener noreferrer" role="menuitem" tabIndex={tab} className={ROW} onClick={() => setOpen(false)}>
            <HugeiconsIcon icon={Scroll01Icon} strokeWidth={1} className="size-4.5" />
            <span className="flex-1">{t("rulesTitle")}</span>
            <SquareArrowOutUpRightIcon strokeWidth={1} className="size-4 text-foreground/60" />
          </a>
        )}
        {options && (
          <button type="button" role="menuitem" tabIndex={tab} className={ROW} onClick={() => openDialog("settings")}>
            <SlidersHorizontalIcon strokeWidth={1} className="size-4.5" />
            {t("gameSettingsMenu")}
          </button>
        )}
        {SEPARATOR}
        <button type="button" role="menuitem" tabIndex={tab} className={ROW} onClick={() => openDialog("cookies")}>
          <CookieIcon strokeWidth={1} className="size-4.5" />
          {t("cookiesMenu")}
        </button>
        <button type="button" role="menuitem" tabIndex={tab} className={ROW} onClick={() => openDialog("legal")}>
          <ScaleIcon strokeWidth={1} className="size-4.5" />
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
