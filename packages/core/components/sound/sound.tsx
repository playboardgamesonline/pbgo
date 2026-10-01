"use client"

import { Volume2Icon, VolumeXIcon } from "lucide-react"
import { useEffect, useState, useSyncExternalStore } from "react"
import { cn } from "@pbgo/ui/utils"
import { useText } from "../skin-provider"
import { currentVolumes, initSound, persistSoundEnabled, playSound, readSoundEnabled, setSoundOn, setVolumes, SOUNDS } from "../../lib/sound"
import { DEFAULT_REACTIONS, playReaction } from "../../lib/soundboard"

const listeners = new Set<() => void>()

export function setSoundEnabled(on: boolean) {
  persistSoundEnabled(on)
  setSoundOn(on)
  listeners.forEach((f) => f())
}

export function useSoundEnabled() {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    readSoundEnabled,
    () => false,
  )
}

/** Bouton rond commun (son, règles…) des écrans et de la partie. */
export const ICON_BUTTON =
  "flex size-11 cursor-pointer items-center justify-center rounded-full text-foreground transition-transform hover:scale-110 drop-shadow-[0_1px_3px_rgb(0_0_0/60%)]"

/** Bouton du son : ouvre le panneau de réglages (`SoundPanel`) ; l'icône reflète l'état activé / coupé. */
export function SoundButton({
  className,
  iconClass = "size-7",
  stroke = 1.6,
  open,
  onClick,
}: {
  className?: string
  iconClass?: string
  stroke?: number
  open?: boolean
  onClick?: () => void
}) {
  const on = useSoundEnabled()
  const t = useText()
  if (!Object.keys(SOUNDS.effects).length && !SOUNDS.music && !SOUNDS.ambience) return null
  const label = t("soundSettings")
  return (
    <button type="button" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} className={cn(ICON_BUTTON, className)} onClick={onClick}>
      {on ? <Volume2Icon strokeWidth={stroke} className={iconClass} /> : <VolumeXIcon strokeWidth={stroke} className={iconClass} />}
    </button>
  )
}

const SLIDER =
  "h-5 w-full cursor-pointer appearance-none bg-transparent outline-none " +
  "[&::-webkit-slider-runnable-track]:h-px [&::-webkit-slider-runnable-track]:bg-foreground/40 " +
  "[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground " +
  "[&::-moz-range-track]:h-px [&::-moz-range-track]:bg-foreground/40 [&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground"

type Channel = "music" | "ambience" | "effects" | "alerts" | "reactions"

/** Panneau de réglages : activer / couper, puis un curseur par catégorie (musique, ambiance, effets, alertes, réactions). */
export function SoundPanel({ open, className }: { open: boolean; className?: string }) {
  const t = useText()
  const on = useSoundEnabled()
  const [volumes, setLocal] = useState(currentVolumes)
  const tracks = Object.entries(SOUNDS.music ?? {})
  const rows: { key: Channel; label: string; show: boolean; preview: () => void }[] = [
    { key: "music", label: t("soundMusic"), show: tracks.length > 0, preview: () => undefined },
    { key: "ambience", label: t("soundAmbience"), show: !!SOUNDS.ambience, preview: () => undefined },
    { key: "effects", label: t("soundEffects"), show: Object.keys(SOUNDS.effects).length > 0, preview: () => playSound("click") },
    { key: "alerts", label: t("soundAlerts"), show: true, preview: () => playSound("turn", { bus: "alerts" }) },
    { key: "reactions", label: t("soundReactions"), show: true, preview: () => playReaction(DEFAULT_REACTIONS[0]!) },
  ]
  const change = (key: Channel, value: number) => {
    setLocal((v) => ({ ...v, [key]: value }))
    setVolumes({ [key]: value })
  }
  return (
    <div
      role="dialog"
      aria-label={t("soundSettings")}
      aria-hidden={!open}
      className={cn(
        "absolute top-full z-50 mt-3 flex w-52 flex-col gap-3 rounded-xl border border-foreground/15 bg-surface/95 p-4 text-foreground shadow-xl backdrop-blur-sm transition-opacity duration-200 [&_svg_*]:[vector-effect:non-scaling-stroke]",
        open ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-medium">{t("soundTitle")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? t("soundOff") : t("soundOn")}
          tabIndex={open ? 0 : -1}
          onClick={() => setSoundEnabled(!on)}
          className="relative h-5 w-9 cursor-pointer rounded-full border border-foreground/60 transition-colors"
        >
          <span className={cn("absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-foreground transition-all", on ? "left-[19px]" : "left-[3px] opacity-60")} />
        </button>
      </div>
      <div className={cn("flex flex-col gap-2.5 transition-opacity", !on && "opacity-45")}>
        {rows
          .filter((r) => r.show)
          .map((r) => (
            <label key={r.key} className="flex flex-col gap-0.5 text-base text-foreground">
              {r.label}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volumes[r.key]}
                tabIndex={open ? 0 : -1}
                aria-label={r.label}
                className={SLIDER}
                onChange={(e) => change(r.key, Number(e.target.value))}
                onPointerUp={r.preview}
              />
            </label>
          ))}
      </div>
    </div>
  )
}

/** À monter une fois dans le layout : réveille l'audio au premier geste et joue `click` sur tout bouton ou lien. */
export function SoundEngine() {
  useEffect(() => {
    setSoundOn(readSoundEnabled())
    const wake = () => initSound()
    const click = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("button, a, [role=button]")) playSound("click")
    }
    window.addEventListener("pointerdown", wake)
    window.addEventListener("keydown", wake)
    window.addEventListener("click", click, true)
    return () => {
      window.removeEventListener("pointerdown", wake)
      window.removeEventListener("keydown", wake)
      window.removeEventListener("click", click, true)
    }
  }, [])
  return null
}
