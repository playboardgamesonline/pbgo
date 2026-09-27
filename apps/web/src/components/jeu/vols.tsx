"use client"

import { motion } from "motion/react"
import { useState } from "react"
import { Dos } from "./carte"
import { useJeu } from "./contexte"

export type Vol = { id: string; joueurId: string; delai: number }

function VolCarte({ vol, onFin }: { vol: Vol; onFin: () => void }) {
  const { rect } = useJeu()
  const [trajet] = useState(() => {
    const depart = rect("pioche")
    const arrivee = rect(`chateau:${vol.joueurId}`)
    return depart && arrivee ? { depart, arrivee } : null
  })
  if (!trajet) return null
  const { depart, arrivee } = trajet
  return (
    <motion.div
      className="pointer-events-none fixed z-50"
      style={{ left: depart.left, top: depart.top }}
      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      animate={{ x: arrivee.left + arrivee.width / 2 - depart.left - 27, y: arrivee.top - depart.top, scale: 0.4, opacity: 0.2 }}
      transition={{ duration: 0.7, delay: vol.delai, ease: "easeInOut" }}
      onAnimationComplete={onFin}
    >
      <Dos taille="sm" />
    </motion.div>
  )
}

export function Vols({ vols, onFin }: { vols: Vol[]; onFin: (id: string) => void }) {
  return (
    <>
      {vols.map((v) => (
        <VolCarte key={v.id} vol={v} onFin={() => onFin(v.id)} />
      ))}
    </>
  )
}
