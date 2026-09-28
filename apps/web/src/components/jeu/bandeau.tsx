"use client"

import type { EvenementVisible } from "@courtisans/engine"
import { motion } from "motion/react"
import { useMemo } from "react"
import { useJeu } from "./contexte"
import { Message } from "./message"
import { PseudoJoueur } from "./pseudo"

type Action = Extract<EvenementVisible, { type: "carteJouee" | "carteEliminee" }>
type Tour = { joueurId: string; actions: { e: Action; i: number }[]; fini: boolean }

function regrouper(journal: EvenementVisible[]) {
  const tours: Tour[] = []
  journal.forEach((e, i) => {
    const dernier = tours.at(-1)
    if (e.type === "pioche") {
      if (dernier?.joueurId === e.joueurId) dernier.fini = true
      return
    }
    if (e.type !== "carteJouee" && e.type !== "carteEliminee") return
    if (!dernier || dernier.fini || dernier.joueurId !== e.joueurId) tours.push({ joueurId: e.joueurId, actions: [{ e, i }], fini: false })
    else dernier.actions.push({ e, i })
  })
  return tours
}

function Tour({ joueurId, court }: { joueurId: string; court?: boolean }) {
  const moiId = useJeu().vue.moi?.id
  if (joueurId === moiId) return <>{court ? "Votre tour" : "C'est votre tour"}</>
  return (
    <>
      {court ? "Tour de" : "C'est au tour de"} <PseudoJoueur id={joueurId} />
    </>
  )
}

export function Bandeau() {
  const { vue } = useJeu()
  const actif = vue.phase === "jeu" ? vue.joueurActifId : null
  const tours = useMemo(
    () =>
      regrouper(vue.journal)
        .map((t, n) => ({ ...t, n }))
        .reverse(),
    [vue.journal],
  )

  return (
    <div className="flex max-w-lg flex-col items-end text-right text-foreground [text-shadow:0_1px_4px_rgb(0_0_0/60%)]">
      <motion.p
        key={actif ?? "attente"}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="inline-flex items-center gap-1.5 font-display text-lg tracking-[0.14em] uppercase md:text-xl"
      >
        {actif ? <Tour joueurId={actif} /> : "Le banquet commence…"}
      </motion.p>
      <div className="mt-3 mb-3 h-px w-full min-w-64 bg-white/25" />
      <div
        className="pointer-events-auto max-h-[12.5rem] w-full overflow-y-auto pr-1 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
        }}
      >
        <ol className="flex flex-col items-end gap-5 text-lg md:text-xl">
          {tours.map((t) => (
            <motion.li
              key={t.n}
              layout="position"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-end gap-2.5"
            >
              <span className="inline-flex items-center gap-1 font-display text-xs tracking-[0.18em] text-foreground/55 uppercase md:text-sm">
                <Tour joueurId={t.joueurId} court />
              </span>
              {t.actions.map(({ e, i }) => (
                <motion.div key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <Message evenement={e} className="justify-end" />
                </motion.div>
              ))}
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  )
}
