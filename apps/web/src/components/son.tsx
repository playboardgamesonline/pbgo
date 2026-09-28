"use client"

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

const ONDE =
  "M0.0 10.00 L0.5 8.66 L1.0 7.40 L1.5 6.26 L2.0 5.31 L2.5 4.59 L3.0 4.15 L3.5 4.00 L4.0 4.15 L4.5 4.59 L5.0 5.31 L5.5 6.26 L6.0 7.40 L6.5 8.66 L7.0 10.00 L7.5 11.34 L8.0 12.60 L8.5 13.74 L9.0 14.69 L9.5 15.41 L10.0 15.85 L10.5 16.00 L11.0 15.85 L11.5 15.41 L12.0 14.69 L12.5 13.74 L13.0 12.60 L13.5 11.34 L14.0 10.00 L14.5 8.66 L15.0 7.40 L15.5 6.26 L16.0 5.31 L16.5 4.59 L17.0 4.15 L17.5 4.00 L18.0 4.15 L18.5 4.59 L19.0 5.31 L19.5 6.26 L20.0 7.40 L20.5 8.66 L21.0 10.00 L21.5 11.34 L22.0 12.60 L22.5 13.74 L23.0 14.69 L23.5 15.41 L24.0 15.85 L24.5 16.00 L25.0 15.85 L25.5 15.41 L26.0 14.69 L26.5 13.74 L27.0 12.60 L27.5 11.34 L28.0 10.00 L28.5 8.66 L29.0 7.40 L29.5 6.26 L30.0 5.31 L30.5 4.59 L31.0 4.15 L31.5 4.00 L32.0 4.15 L32.5 4.59 L33.0 5.31 L33.5 6.26 L34.0 7.40 L34.5 8.66 L35.0 10.00 L35.5 11.34 L36.0 12.60 L36.5 13.74 L37.0 14.69 L37.5 15.41 L38.0 15.85 L38.5 16.00 L39.0 15.85 L39.5 15.41 L40.0 14.69 L40.5 13.74 L41.0 12.60 L41.5 11.34 L42.0 10.00 L42.5 8.66 L43.0 7.40 L43.5 6.26 L44.0 5.31 L44.5 4.59 L45.0 4.15 L45.5 4.00 L46.0 4.15 L46.5 4.59 L47.0 5.31 L47.5 6.26 L48.0 7.40 L48.5 8.66 L49.0 10.00 L49.5 11.34 L50.0 12.60 L50.5 13.74 L51.0 14.69 L51.5 15.41 L52.0 15.85 L52.5 16.00 L53.0 15.85 L53.5 15.41 L54.0 14.69 L54.5 13.74 L55.0 12.60 L55.5 11.34 L56.0 10.00"

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
      <motion.svg
        key={impulsion}
        initial={impulsion ? { scale: 0.7 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
        viewBox="0 0 28 20"
        className="h-5 w-7 overflow-hidden drop-shadow-[0_1px_3px_rgb(0_0_0/60%)]"
        fill="none"
      >
        <motion.g
          animate={{ scaleY: actif ? 1 : 0.06, opacity: actif ? 1 : 0.7 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          style={{ originY: "10px" }}
        >
          <motion.path
            d={ONDE}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            animate={actif ? { x: [0, -28] } : { x: 0 }}
            transition={actif ? { duration: 1.4, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
          />
        </motion.g>
      </motion.svg>
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
