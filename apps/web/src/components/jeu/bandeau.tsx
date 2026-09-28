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

function EnTete({ joueurId }: { joueurId: string }) {
  const moiId = useJeu().vue.moi?.id
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#f5c542]/70 bg-[#02161a]/60 px-3 py-1 font-display text-sm tracking-[0.12em] text-[#fff4d6] uppercase shadow-[0_0_14px_rgb(245_197_66/25%)] md:text-base">
      {joueurId === moiId ? (
        "C'est votre tour"
      ) : (
        <>
          C&apos;est au tour de <PseudoJoueur id={joueurId} />
        </>
      )}
    </span>
  )
}

export function Bandeau() {
  const { vue } = useJeu()
  const tours = useMemo(() => {
    const liste = regrouper(vue.journal)
    const actif = vue.phase === "jeu" ? vue.joueurActifId : null
    const dernier = liste.at(-1)
    if (actif && (!dernier || dernier.fini || dernier.joueurId !== actif)) liste.push({ joueurId: actif, actions: [], fini: false })
    return liste.map((t, n) => ({ ...t, n })).reverse()
  }, [vue.journal, vue.phase, vue.joueurActifId])

  return (
    <div
      className="pointer-events-auto max-h-[42vh] max-w-lg overflow-y-auto pr-1 pb-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
      }}
    >
      <ol className="flex flex-col items-end gap-4 text-right text-lg text-foreground md:text-xl [text-shadow:0_1px_4px_rgb(0_0_0/60%)]">
        {tours.length === 0 && <li className="text-foreground/80">Le banquet commence…</li>}
        {tours.map((t) => (
          <motion.li
            key={t.n}
            layout="position"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-end gap-1.5"
          >
            <EnTete joueurId={t.joueurId} />
            {t.actions.map(({ e, i }) => (
              <motion.div key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <Message evenement={e} className="justify-end" />
              </motion.div>
            ))}
          </motion.li>
        ))}
      </ol>
    </div>
  )
}
