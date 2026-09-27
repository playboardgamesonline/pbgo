"use client"

import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { useJeu } from "./contexte"
import { Message } from "./message"
import { PseudoJoueur } from "./pseudo"

const DUREE_PIOCHE = 2000

export function Bandeau() {
  const { vue } = useJeu()
  const n = vue.journal.length
  const dernier = n > 0 ? vue.journal[n - 1] : null
  const [piocheVue, setPiocheVue] = useState(-1)

  useEffect(() => {
    if (dernier?.type !== "pioche") return
    const t = setTimeout(() => setPiocheVue(n), DUREE_PIOCHE)
    return () => clearTimeout(t)
  }, [n, dernier?.type])

  const tour = vue.phase === "jeu" && !!vue.joueurActifId && (!dernier || (dernier.type === "pioche" && piocheVue === n))

  return (
    <div className="pointer-events-auto absolute top-0 left-1/2 z-20 w-[min(46rem,calc(100vw-12rem))] -translate-x-1/2 rounded-b-2xl border-x-2 border-b-2 border-[#6e4a26] bg-[#0b2231]/95 px-1 pb-1 shadow-[0_10px_30px_rgb(0_0_0/55%)]">
      <div className="flex min-h-16 items-center justify-center rounded-b-xl border-x border-b border-[#8a6a3a]/40 px-6 py-3 text-center text-lg md:text-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={tour ? `tour-${vue.joueurActifId}` : `e-${n}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22 }}
          >
            {tour ? (
              <span className="inline-flex items-center gap-1.5">
                C&apos;est à <PseudoJoueur id={vue.joueurActifId!} /> de jouer
              </span>
            ) : dernier ? (
              <Message evenement={dernier} />
            ) : (
              <span className="text-foreground/80">Le banquet commence…</span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
