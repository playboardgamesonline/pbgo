"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"
import { BoutonCour } from "@/components/banquet/ecran-banquet"
import { COULEURS_JOUEURS } from "@/components/jeu/contexte"
import { api } from "@/lib/api"
import { MIN_JOUEURS, type PartiePublique } from "@/lib/partie-types"

export function Couronne({ className }: { className?: string }) {
  return (
    <span
      aria-label="Hôte"
      role="img"
      className={className ?? "inline-block size-7 shrink-0 bg-primary"}
      style={{ maskImage: "url(/pictograms/PICTOGRAM_NOBLE.webp)", maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" }}
    />
  )
}

export function ListeConvives({ partie }: { partie: PartiePublique }) {
  return (
    <ul className="mt-[4vh] flex w-full max-w-md shrink-0 flex-col items-center gap-1.5 px-4">
      <AnimatePresence>
        {partie.joueurs.map((j, i) => (
          <motion.li
            key={j.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex items-center gap-2.5 font-sans text-2xl font-black tracking-[0.12em] uppercase [text-shadow:0_1px_6px_rgb(0_0_0/50%)]"
            style={{ color: COULEURS_JOUEURS[i % COULEURS_JOUEURS.length] }}
          >
            {j.id === partie.hoteId && <Couronne />}
            <span className="brightness-150">{j.pseudo}</span>
            {j.id === partie.moiId && <span className="text-sm font-semibold tracking-normal text-foreground/60 normal-case">(vous)</span>}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

export function BoutonLobby({ partie, onMaj }: { partie: PartiePublique; onMaj: (p: PartiePublique) => void }) {
  const [lancement, setLancement] = useState(false)
  const estHote = partie.moiId === partie.hoteId
  const assez = partie.joueurs.length >= MIN_JOUEURS

  async function lancer() {
    setLancement(true)
    try {
      onMaj(await api.lancer(partie.code))
    } catch (e) {
      toast.error((e as Error).message)
      setLancement(false)
    }
  }

  if (!estHote)
    return (
      <BoutonCour disabled occupe>
        En attente de l&apos;hôte
      </BoutonCour>
    )
  return (
    <BoutonCour onClick={lancer} disabled={!assez} occupe={lancement}>
      {assez ? "Ouvrir le banquet" : "En attente de convives…"}
    </BoutonCour>
  )
}
