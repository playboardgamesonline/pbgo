"use client"

import { Volume2Icon, VolumeXIcon } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useState, useSyncExternalStore } from "react"
import { initialiserSon, jouerSon, reglerSon } from "@/lib/son"
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
  reglerSon(actif)
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

export function BoutonSon() {
  const actif = useSonActif()
  const [impulsion, setImpulsion] = useState(0)
  return (
    <button
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
        className="inline-flex drop-shadow-[0_1px_3px_rgb(0_0_0/60%)]"
      >
        {actif ? <Volume2Icon strokeWidth={1.6} className="size-7" /> : <VolumeXIcon strokeWidth={1.6} className="size-7" />}
      </motion.span>
    </button>
  )
}

export function MoteurSon() {
  useEffect(() => {
    reglerSon(lire())
    const reveil = () => initialiserSon()
    const clic = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("button, a, [role=button]")) jouerSon("clic")
    }
    window.addEventListener("pointerdown", reveil)
    window.addEventListener("keydown", reveil)
    window.addEventListener("click", clic, true)
    return () => {
      window.removeEventListener("pointerdown", reveil)
      window.removeEventListener("keydown", reveil)
      window.removeEventListener("click", clic, true)
    }
  }, [])
  return null
}
