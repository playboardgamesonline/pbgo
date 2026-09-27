"use client"

import { AnimatePresence, motion } from "motion/react"
import { useJeu } from "./contexte"
import { Message } from "./message"

const LIBELLES_ZONES = { table: "la table de la Reine", domaine: "ton domaine", domaineAdverse: "un domaine adverse" } as const

export function Bandeau({ aide }: { aide?: string }) {
  const { vue, pseudo } = useJeu()
  const index = vue.journal.findLastIndex((e) => e.type !== "pioche")
  const dernier = index >= 0 ? vue.journal[index] : null
  const monTour = vue.phase === "jeu" && vue.joueurActifId === vue.moi?.id

  return (
    <div className="flex min-h-16 flex-col items-center justify-center gap-1 text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25 }}
          className="text-base md:text-lg"
        >
          {dernier ? <Message evenement={dernier} /> : <span className="text-muted-foreground">Le banquet commence…</span>}
        </motion.div>
      </AnimatePresence>
      {vue.phase === "jeu" && (
        <p className={monTour ? "font-display text-sm tracking-wide text-primary" : "text-sm text-muted-foreground"}>
          {monTour
            ? aide || `À toi de jouer : ${vue.zonesDisponibles.map((z) => LIBELLES_ZONES[z]).join(" · ")}`
            : `Au tour de ${vue.joueurActifId ? pseudo(vue.joueurActifId) : "…"}`}
        </p>
      )}
    </div>
  )
}
