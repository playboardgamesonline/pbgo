"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState, useSyncExternalStore } from "react"
import { BOUTON_ICONE } from "@/components/regles"
import { cn } from "@/lib/utils"

const CLE = "courtisans:son"
const abonnes = new Set<() => void>()

function lire() {
  try {
    return localStorage.getItem(CLE) !== "off"
  } catch {
    return true
  }
}

export function setSonActif(actif: boolean) {
  try {
    localStorage.setItem(CLE, actif ? "on" : "off")
  } catch {}
  abonnes.forEach((f) => f())
}

export function useSonActif() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    lire,
    () => true,
  )
}

const BARRES = [0.55, 1, 0.7, 0.9]

export function BoutonSon() {
  const actif = useSonActif()
  const [impulsion, setImpulsion] = useState(0)
  return (
    <motion.button
      type="button"
      aria-label={actif ? "Couper le son" : "Activer le son"}
      title={actif ? "Couper le son" : "Activer le son"}
      className={cn(BOUTON_ICONE, "inline-flex items-center justify-center")}
      onClick={() => {
        setSonActif(!actif)
        setImpulsion((n) => n + 1)
      }}
    >
      <motion.span
        key={impulsion}
        initial={impulsion ? { scale: 0.7 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
        className="relative flex h-6 items-end gap-[3px] drop-shadow-[0_1px_3px_rgb(0_0_0/60%)]"
      >
        {BARRES.map((h, i) => (
          <motion.span
            key={i}
            className="w-[3px] origin-bottom rounded-full bg-current"
            style={{ height: "100%" }}
            animate={actif ? { scaleY: [h * 0.35, h, h * 0.5, h * 0.85, h * 0.35] } : { scaleY: 0.14 }}
            transition={
              actif
                ? { duration: 0.9 + i * 0.17, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }
                : { type: "spring", stiffness: 300, damping: 18, delay: i * 0.04 }
            }
          />
        ))}
        <AnimatePresence>
          {!actif && (
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute top-1/2 -left-1 h-[2px] w-[calc(100%+0.5rem)] origin-left -rotate-45 rounded-full bg-current"
            />
          )}
        </AnimatePresence>
      </motion.span>
    </motion.button>
  )
}
