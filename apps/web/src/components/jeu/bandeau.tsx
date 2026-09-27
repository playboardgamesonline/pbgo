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
    <div className="max-w-lg text-left text-lg text-foreground md:text-2xl [text-shadow:0_1px_4px_rgb(0_0_0/60%)]">
      <AnimatePresence mode="wait">
        <motion.div
          key={tour ? `tour-${vue.joueurActifId}` : `e-${n}`}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{ duration: 0.2 }}
        >
          {tour ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {vue.joueurActifId === vue.moi?.id ? (
                "C'est à vous de jouer"
              ) : (
                <>
                  C&apos;est à <PseudoJoueur id={vue.joueurActifId!} /> de jouer
                </>
              )}
            </span>
          ) : dernier ? (
            <Message evenement={dernier} className="justify-start" />
          ) : (
            <span className="text-foreground/80">Le banquet commence…</span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
