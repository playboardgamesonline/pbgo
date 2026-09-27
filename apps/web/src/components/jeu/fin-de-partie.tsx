"use client"

import { FAMILLES, type VueJoueur } from "@courtisans/engine"
import { HomeIcon, Loader2Icon, RotateCcwIcon } from "lucide-react"
import { AnimatePresence, animate, motion } from "motion/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ChateauImage } from "@/components/chateau"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { CatalogueClient } from "@/lib/catalogue"
import type { PartiePublique } from "@/lib/partie-types"
import { cn } from "@/lib/utils"
import { useJeu } from "./contexte"
import { PictoFamille } from "./pictos"

const DUREES = [1400, 2200, 2800, 2600]

function Compteur({ valeur, duree = 2 }: { valeur: number; duree?: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const controle = animate(0, valeur, { duration: duree, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) })
    return () => controle.stop()
  }, [valeur, duree])
  return <span className="tabular-nums">{n}</span>
}

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

export function FinDePartie({ onMaj }: { onMaj: (p: PartiePublique) => void }) {
  const { vue, partie, catalogue } = useJeu()
  const [etape, setEtape] = useState(DUREES.length)
  const [envoi, setEnvoi] = useState(false)
  const resultats = vue.resultats

  useEffect(() => {
    if (!resultats || etape >= DUREES.length) return
    const t = setTimeout(() => setEtape((e) => e + 1), DUREES[etape])
    return () => clearTimeout(t)
  }, [resultats, etape])

  if (vue.phase !== "fin" || !resultats) return null

  const info = (id: string) => partie.joueurs.find((j) => j.id === id)
  const chateau = (id: string) => catalogue.chateaux.find((c) => c.id === info(id)?.chateau)
  const vainqueurs = resultats.joueurs.filter((j) => resultats.vainqueurs.includes(j.joueurId))
  const autres = resultats.joueurs.filter((j) => !resultats.vainqueurs.includes(j.joueurId))
  const points = vainqueurs[0]?.total ?? 0
  const phrase = catalogue.phrasesVainqueur[hash(partie.code + vue.journal.length) % catalogue.phrasesVainqueur.length]!.replace(
    "{pseudo}",
    vainqueurs.map((v) => info(v.joueurId)?.pseudo).join(" & "),
  ).replace("{points}", String(points))
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 p-6 transition-colors duration-700",
        etape === 0 ? "bg-background/30" : "bg-background/95 backdrop-blur-md",
      )}
    >
      <AnimatePresence mode="wait">
        {etape === 0 && (
          <motion.p
            key="e0"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-full bg-card/90 px-6 py-3 font-display text-2xl text-primary shadow-2xl"
          >
            Les espions se dévoilent…
          </motion.p>
        )}

        {etape === 1 && (
          <motion.div key="e1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 text-center">
            <h2 className="font-display text-3xl text-primary">Le verdict de la Reine</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {FAMILLES.map((f, i) => {
                const s = resultats.statuts[f]
                return (
                  <motion.div
                    key={f}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.2 }}
                    className={cn(
                      "flex w-28 flex-col items-center gap-2 rounded-xl border p-3",
                      s.statut === "lumiere" && "border-primary bg-primary/20",
                      s.statut === "disgrace" && "border-black/40 bg-black/40",
                    )}
                  >
                    <PictoFamille famille={f} className="size-10" />
                    <span className="text-sm">{catalogue.familles[f].nom}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      ▲{s.haut} ▼{s.bas}
                    </span>
                    <span className={cn("text-xs font-semibold uppercase", s.statut === "lumiere" ? "text-primary" : "text-muted-foreground")}>
                      {s.statut === "lumiere" ? "Lumière" : s.statut === "disgrace" ? "Disgrâce" : "Neutre"}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {etape === 2 && (
          <motion.div key="e2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md space-y-3">
            <h2 className="text-center font-display text-3xl text-primary">Décompte des points</h2>
            {resultats.joueurs.map((j) => (
              <div key={j.joueurId} className="flex items-center gap-3 rounded-xl bg-card/80 px-4 py-2">
                <ChateauImage chateau={chateau(j.joueurId)} className="size-9" />
                <span className="flex-1 text-lg">{info(j.joueurId)?.pseudo}</span>
                <span className="font-display text-2xl text-primary">
                  <Compteur valeur={j.total} /> pts
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {etape === 3 && (
          <motion.p
            key="e3"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", damping: 12 }}
            className="max-w-3xl text-center font-display text-4xl leading-tight text-primary drop-shadow-[0_0_30px_var(--primary)] md:text-5xl"
          >
            {phrase}
          </motion.p>
        )}

        {etape >= 4 && (
          <motion.div key="e4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-4 text-center">
            <div className="space-y-1 rounded-2xl border border-primary bg-primary/10 p-6">
              <p className="font-display text-xl text-primary">({points} pts)</p>
              <p className="font-display text-3xl">{vainqueurs.map((v) => info(v.joueurId)?.pseudo).join(" & ")}</p>
              <div className="flex justify-center gap-4 pt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/pictos/picto-noble.webp" alt="" className="h-16 w-auto drop-shadow-[0_0_18px_rgb(242_193_78/70%)]" />
              </div>
            </div>
            <ol className="divide-y divide-border">
              {autres.map((j) => (
                <li key={j.joueurId} className="flex items-center justify-between py-3 text-lg">
                  <span>
                    <span className="mr-2 text-muted-foreground">{j.rang}.</span>
                    {info(j.joueurId)?.pseudo}
                  </span>
                  <span className="tabular-nums">({j.total} pts)</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-2 pt-2">
              <Button size="lg" className="h-12 font-display text-base" disabled={dejaVote || envoi} onClick={rejouer}>
                {envoi ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
                Rejouer ({partie.rejouer.length}/{partie.joueurs.length})
              </Button>
              <Button asChild variant="ghost">
                <Link href="/">
                  <HomeIcon />
                  Retour à l&apos;accueil
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {etape < 4 && (
        <Button variant="ghost" size="sm" className="absolute right-4 bottom-4" onClick={() => setEtape(4)}>
          Passer
        </Button>
      )}
    </motion.div>
  )
}
