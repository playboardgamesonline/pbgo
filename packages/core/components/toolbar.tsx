"use client"

import { LinkIcon, MaximizeIcon, MinimizeIcon, SettingsIcon } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "@pbgo/ui/utils"
import type { RulesContent } from "../lib/rules"
import { LOCALES, LOCALE_NAMES } from "../lib/i18n"
import { currentVolumes, setVolumes } from "../lib/sound"
import { FeedbackButton } from "./feedback"
import { setLocaleCookie } from "./language-select"
import { GameRulesButton as RulesButton } from "./rules-slot"
import { SoundButton } from "./sound/sound"
import { useSkin, useText } from "./skin-provider"
import { useRouter } from "next/navigation"

const MICRO = "size-8 [&_svg]:size-[18px] hover:scale-110"
const ROW = "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/10"

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 px-3 py-1.5 text-sm">
      <span className="w-16 shrink-0 text-foreground/80">{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--color-accent-game,currentColor)]" />
    </label>
  )
}

/**
 * Commandes discrètes à droite du logo : un bouton réglages (engrenage → langue, volumes, plein écran, lien d'invitation, feedback)
 * et dessous deux micro-boutons, le son (animé selon la musique) et les règles.
 * Les fenêtres (règles, feedback) restent montées même menu fermé pour conserver leur état.
 */
export function Toolbar({ rules, gameCode, align = "left" }: { rules?: RulesContent; gameCode?: string; align?: "left" | "right" }) {
  const t = useText()
  const { locale } = useSkin()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [volumes, setLocalVolumes] = useState(currentVolumes)
  const [fullscreen, setFullscreen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", update)
    return () => document.removeEventListener("fullscreenchange", update)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) return void (e.key === "Escape" && setOpen(false))
      const target = e.target as Element | null
      // les fenêtres (feedback) sont rendues hors du menu : cliquer dedans ne le referme pas
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
  const volume = (key: "music" | "effects", v: number) => {
    setVolumes({ [key]: v })
    setLocalVolumes(currentVolumes())
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }
  const copyInvite = async () => {
    if (!gameCode) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/game/${gameCode}`)
      toast.success(t("linkCopied"))
    } catch {}
  }

  const label = open ? t("closeMenu") : t("menu")
  return (
    <div ref={root} className="relative flex flex-col items-center gap-0.5">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-10 cursor-pointer items-center justify-center rounded-full text-foreground transition-transform hover:scale-110 drop-shadow-[0_1px_3px_rgb(0_0_0/60%)]"
        onClick={() => setOpen((o) => !o)}
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="inline-flex">
          <SettingsIcon strokeWidth={1.6} className="size-6" />
        </motion.span>
      </button>
      <div className="flex items-center gap-0.5">
        <SoundButton className={MICRO} size={20} />
        {rules && <RulesButton rules={rules} className={MICRO} />}
      </div>
      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          "absolute top-10 z-50 mt-1 flex w-64 flex-col gap-1 rounded-xl border border-foreground/15 bg-surface/95 p-2 text-foreground shadow-xl backdrop-blur-sm transition-[opacity,transform] duration-200",
          align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <p className="px-3 pt-1 text-[11px] font-semibold tracking-[0.14em] text-foreground/50 uppercase">{t("language")}</p>
        <div className="flex items-center gap-1 px-2 pb-1" role="group" aria-label={t("language")}>
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
        <div className="border-t border-foreground/15 pt-1">
          <p className="px-3 pt-1 text-[11px] font-semibold tracking-[0.14em] text-foreground/50 uppercase">{t("menuSound")}</p>
          <Slider label={t("volumeMusic")} value={volumes.music} onChange={(v) => volume("music", v)} />
          <Slider label={t("volumeEffects")} value={volumes.effects} onChange={(v) => volume("effects", v)} />
        </div>
        <div className="border-t border-foreground/15 pt-1">
          {gameCode && (
            <button type="button" className={ROW} tabIndex={open ? 0 : -1} onClick={copyInvite}>
              <LinkIcon strokeWidth={1.6} className="size-4.5" />
              {t("copyLink")}
            </button>
          )}
          <button type="button" className={ROW} tabIndex={open ? 0 : -1} onClick={toggleFullscreen}>
            {fullscreen ? <MinimizeIcon strokeWidth={1.6} className="size-4.5" /> : <MaximizeIcon strokeWidth={1.6} className="size-4.5" />}
            {fullscreen ? t("exitFullscreen") : t("fullscreen")}
          </button>
          <FeedbackButton gameCode={gameCode} asRow />
        </div>
      </div>
    </div>
  )
}
