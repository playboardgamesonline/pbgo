"use client"

import { Volume2Icon, VolumeXIcon } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useState, useSyncExternalStore } from "react"
import { cn } from "@pgo/ui/utils"
import { initSound, persistSoundEnabled, playSound, readSoundEnabled, setSoundOn, SOUNDS } from "../../lib/sound"

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

export function SoundButton({ className }: { className?: string }) {
  const on = useSoundEnabled()
  const [pulse, setPulse] = useState(0)
  if (!Object.keys(SOUNDS.effects).length && !SOUNDS.music && !SOUNDS.ambience) return null
  const label = on ? "Couper le son" : "Activer le son"
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(ICON_BUTTON, className)}
      onClick={() => {
        setSoundEnabled(!on)
        setPulse((n) => n + 1)
      }}
    >
      <motion.span
        key={pulse}
        initial={pulse ? { scale: 0.7 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
        className="inline-flex"
      >
        {on ? <Volume2Icon strokeWidth={1.6} className="size-7" /> : <VolumeXIcon strokeWidth={1.6} className="size-7" />}
      </motion.span>
    </button>
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
