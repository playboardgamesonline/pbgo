"use client"

import { AnimatePresence, motion } from "motion/react"
import { useJeu } from "./contexte"
import { Message } from "./message"
import { PseudoJoueur } from "./pseudo"

const LIBELLES_ZONES = { table: "la table de la Reine", domaine: "ton domaine", domaineAdverse: "un domaine adverse" } as const

export function Bandeau({ aide }: { aide?: React.ReactNode }) {
  const { vue } = useJeu()
  const index = vue.journal.findLastIndex((e) => e.type !== "pioche")
  const dernier = index >= 0 ? vue.journal[index] : null
  const monTour = vue.phase === "jeu" && vue.joueurActifId === vue.moi?.id

  return (
    <div className="pointer-events-auto mx-auto w-fit max-w-3xl rounded-xl border-2 border-[#d9a93f] bg-[#0b2231]/95 p-1 shadow-[0_0_0_3px_#3b2414,0_10px_30px_rgb(0_0_0/55%)]">
      <div className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border border-[#d9a93f]/45 px-6 py-2.5 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="text-lg md:text-2xl"
          >
            {dernier ? <Message evenement={dernier} /> : <span className="text-foreground/80">Le banquet commence…</span>}
          </motion.div>
        </AnimatePresence>
        {vue.phase === "jeu" && (
          <div className={monTour ? "text-base text-primary md:text-lg" : "text-base text-foreground/75 md:text-lg"}>
            {monTour ? (
              aide || `À toi de jouer : ${vue.zonesDisponibles.map((z) => LIBELLES_ZONES[z]).join(" · ")}`
            ) : (
              <span className="inline-flex items-center gap-1.5">Au tour de {vue.joueurActifId ? <PseudoJoueur id={vue.joueurActifId} /> : "…"}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
