"use client"

import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"
import { useJeu } from "./contexte"
import { Message } from "./message"
import { PseudoJoueur } from "./pseudo"

const NOMBRE = 5
const PETIT = "text-sm md:text-base text-foreground/75"

export function Bandeau() {
  const { vue } = useJeu()
  const derniers = vue.journal
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.type !== "finDePartie")
    .slice(-NOMBRE)
    .reverse()
  const tour = vue.phase === "jeu" && !!vue.joueurActifId

  return (
    <ol className="flex max-w-lg flex-col items-end gap-1.5 text-right text-lg text-foreground md:text-xl [text-shadow:0_1px_4px_rgb(0_0_0/60%)]">
      <AnimatePresence initial={false} mode="popLayout">
        {tour && (
          <motion.li
            key={`tour-${vue.numeroTour}-${vue.joueurActifId}`}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(PETIT, "italic")}
          >
            {vue.joueurActifId === vue.moi?.id ? (
              "C'est à vous de jouer"
            ) : (
              <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                C&apos;est à <PseudoJoueur id={vue.joueurActifId!} /> de jouer
              </span>
            )}
          </motion.li>
        )}
        {derniers.length === 0 && !tour && (
          <motion.li key="debut" className="text-foreground/80">
            Le banquet commence…
          </motion.li>
        )}
        {derniers.map(({ e, i }, rang) => (
          <motion.li
            key={i}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1 - rang * 0.1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(e.type === "pioche" && PETIT)}
          >
            <Message evenement={e} className="justify-end" />
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  )
}
