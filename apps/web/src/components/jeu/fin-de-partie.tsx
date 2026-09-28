"use client"

import type { VueJoueur } from "@courtisans/engine"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { BoutonCour } from "@/components/banquet/ecran-banquet"
import { Couronne } from "@/components/partie/lobby"
import { api } from "@/lib/api"
import type { CatalogueClient } from "@/lib/catalogue"
import type { PartiePublique } from "@/lib/partie-types"
import { cn } from "@/lib/utils"
import { useJeu } from "./contexte"

function hash(texte: string) {
  let h = 0
  for (const c of texte) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

export function phraseVainqueur(partie: PartiePublique, vue: VueJoueur, catalogue: CatalogueClient) {
  const resultats = vue.resultats
  if (!resultats) return ""
  const info = (id: string) => partie.joueurs.find((j) => j.id === id)
  const vainqueurs = resultats.joueurs.filter((j) => resultats.vainqueurs.includes(j.joueurId))
  return catalogue.phrasesVainqueur[hash(partie.code + vue.journal.length) % catalogue.phrasesVainqueur.length]!.replace(
    "{pseudo}",
    vainqueurs.map((v) => info(v.joueurId)?.pseudo).join(" & "),
  ).replace("{points}", String(vainqueurs[0]?.total ?? 0))
}

export function FinDePartie({ onMaj, ouvert, onBasculer }: { onMaj: (p: PartiePublique) => void; ouvert: boolean; onBasculer: () => void }) {
  const { vue, partie, couleur } = useJeu()
  const [envoi, setEnvoi] = useState(false)
  const resultats = vue.resultats
  if (vue.phase !== "fin" || !resultats) return null

  const info = (id: string) => partie.joueurs.find((j) => j.id === id)
  const vainqueurs = resultats.joueurs.filter((j) => resultats.vainqueurs.includes(j.joueurId))
  const autres = resultats.joueurs.filter((j) => !resultats.vainqueurs.includes(j.joueurId))
  const dejaVote = !!partie.moiId && partie.rejouer.includes(partie.moiId)

  async function rejouer() {
    setEnvoi(true)
    try {
      onMaj(await api.rejouer(partie.code))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {ouvert && (
          <motion.div
            key="fond"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#020c0f]/55"
            onClick={onBasculer}
          />
        )}
      </AnimatePresence>
      <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 p-6">
        <AnimatePresence>
          {ouvert && (
            <motion.section
              key="tableau"
              role="dialog"
              aria-label="Tableau des scores"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              className="pointer-events-auto w-full max-w-xl space-y-5 rounded-2xl border border-[#8a6a3a]/60 bg-[#0b2231]/95 p-7 shadow-[0_20px_60px_rgb(0_0_0/60%)]"
            >
              <h2 className="text-center font-display text-2xl tracking-wide text-foreground">Tableau des scores</h2>

              <div
                className="relative overflow-hidden rounded-xl border border-[#d9a93f]/60 bg-[#f4ecd6] bg-cover bg-center px-6 py-5 text-center text-[#1b2a2e] shadow-inner"
                style={{ backgroundImage: "var(--image-papier)" }}
              >
                <Couronne className="mx-auto mb-1 block h-10 w-9 bg-[#b88a2a]" />
                <p className="font-sans text-3xl font-black tracking-[0.12em] uppercase" style={{ color: couleur(vainqueurs[0]!.joueurId) }}>
                  {vainqueurs.map((v) => info(v.joueurId)?.pseudo).join(" & ")}
                </p>
                <p className="mt-1 font-display text-lg text-[#6b4a1a]">{vainqueurs[0]!.total} points · Favori de la cour</p>
              </div>

              {autres.length > 0 && (
                <ol className="divide-y divide-foreground/15">
                  {autres.map((j) => (
                    <li key={j.joueurId} className="flex items-center justify-between py-2.5 text-lg">
                      <span className="flex items-center gap-3">
                        <span className="w-5 text-foreground/50 tabular-nums">{j.rang}.</span>
                        <span className="font-sans font-black tracking-[0.12em] uppercase brightness-150" style={{ color: couleur(j.joueurId) }}>
                          {info(j.joueurId)?.pseudo}
                        </span>
                      </span>
                      <span className="text-foreground/80 tabular-nums">{j.total} pts</span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="flex flex-col items-center gap-2 pt-1">
                <BoutonCour onClick={rejouer} occupe={envoi} disabled={dejaVote}>
                  Rejouer ({partie.rejouer.length}/{partie.joueurs.length})
                </BoutonCour>
                <Link href="/" className="font-display text-sm text-foreground/70 underline-offset-4 hover:text-foreground hover:underline">
                  Retour à l&apos;accueil
                </Link>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={onBasculer}
          className={cn(
            "pointer-events-auto cursor-pointer rounded-full bg-[#0b2231] px-5 py-2 font-display text-base tracking-wide text-foreground/85 transition-transform hover:scale-105 hover:text-foreground",
            !ouvert && "fixed bottom-6",
          )}
        >
          {ouvert ? "Masquer le tableau des scores" : "Afficher le tableau des scores"}
        </button>
      </div>
    </>
  )
}
