"use client"

import type { ResultatJoueur, VueJoueur } from "@courtisans/engine"
import { Share2Icon } from "lucide-react"
import { type LignePartage, partagerResultat } from "./partage"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { BoutonCour } from "@/components/banquet/ecran-banquet"
import { Couronne } from "@/components/partie/lobby"
import { api } from "@/lib/api"
import type { CatalogueClient } from "@/lib/catalogue"
import type { PartiePublique } from "@/lib/partie-types"
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

export function annonceVainqueur(partie: PartiePublique, vue: VueJoueur, catalogue: CatalogueClient) {
  const resultats = vue.resultats
  if (!resultats) return { phrase: "", detail: "" }
  const vainqueurs = resultats.joueurs.filter((j) => resultats.vainqueurs.includes(j.joueurId))
  const modele = catalogue.phrasesVainqueur[hash(partie.code + vue.journal.length) % catalogue.phrasesVainqueur.length]!
  const phrase = modele
    .split("{pseudo}")[0]!
    .replace(/[\s:,–-]+$/, "")
    .trim()
  const noms = vainqueurs.map((v) => partie.joueurs.find((j) => j.id === v.joueurId)?.pseudo).join(" & ")
  return { phrase, detail: `${noms} · ${vainqueurs[0]?.total ?? 0} pts` }
}

function Detail({ j }: { j: ResultatJoueur }) {
  const { catalogue } = useJeu()
  const reussies = j.missions.filter((m) => m.validee).length
  const pointsMissions = j.missions.reduce((t, m) => t + m.points, 0)
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {j.detail
        .filter((d) => d.poids > 0)
        .map((d) => (
          <span
            key={d.famille}
            title={`${catalogue.familles[d.famille].nom} : ${d.points > 0 ? "+" : ""}${d.points}`}
            className="rounded-md px-1.5 py-0.5 font-semibold text-white tabular-nums shadow-sm [text-shadow:0_1px_2px_rgb(0_0_0/50%)]"
            style={{ backgroundColor: catalogue.familles[d.famille].couleur, opacity: d.points === 0 ? 0.55 : 1 }}
          >
            {d.points > 0 ? "+" : ""}
            {d.points}
          </span>
        ))}
      <span className="ml-1 rounded-md bg-[#f2c14e]/20 px-1.5 py-0.5 font-semibold text-[#f2c14e] tabular-nums">
        Missions {reussies}/{j.missions.length} · +{pointsMissions}
      </span>
    </div>
  )
}

export function FinDePartie({ onMaj, ouvert, onBasculer }: { onMaj: (p: PartiePublique) => void; ouvert: boolean; onBasculer: () => void }) {
  const { vue, partie, couleur, catalogue } = useJeu()
  const [envoi, setEnvoi] = useState(false)
  const [partage, setPartage] = useState(false)
  const resultats = vue.resultats
  if (vue.phase !== "fin" || !resultats) return null

  const info = (id: string) => partie.joueurs.find((j) => j.id === id)
  const vainqueurs = resultats.joueurs.filter((j) => resultats.vainqueurs.includes(j.joueurId))
  const autres = resultats.joueurs.filter((j) => !resultats.vainqueurs.includes(j.joueurId))
  const dejaVote = !!partie.moiId && partie.rejouer.includes(partie.moiId)

  async function partager() {
    if (!resultats) return
    setPartage(true)
    try {
      const lignes: LignePartage[] = [...resultats.joueurs]
        .sort((a, b) => a.rang - b.rang)
        .map((j) => ({
          rang: j.rang,
          pseudo: info(j.joueurId)?.pseudo ?? "?",
          couleur: couleur(j.joueurId),
          total: j.total,
          domaine: j.pointsDomaine,
          missions: j.missions.reduce((t, m) => t + m.points, 0),
          missionsReussies: j.missions.filter((m) => m.validee).length,
          familles: j.detail.filter((d) => d.poids > 0).map((d) => ({ couleur: catalogue.familles[d.famille].couleur, points: d.points })),
          vainqueur: resultats.vainqueurs.includes(j.joueurId),
        }))
      const texte = `${vainqueurs.map((v) => info(v.joueurId)?.pseudo).join(" & ")} remporte le banquet avec ${vainqueurs[0]?.total ?? 0} points !`
      const resultat = await partagerResultat(lignes, partie.code, texte)
      if (resultat === "telecharge") toast.success("Image du résultat téléchargée")
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Impossible de partager le résultat")
    } finally {
      setPartage(false)
    }
  }

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
      <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center px-6 pt-6 pb-[calc(20vh+4.5rem)]">
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
              className="pointer-events-auto flex max-h-full w-full max-w-xl flex-col gap-4 rounded-2xl border border-[#8a6a3a]/60 bg-[#0b2231]/95 p-6 shadow-[0_20px_60px_rgb(0_0_0/60%)]"
            >
              <h2 className="text-center font-display text-2xl tracking-wide text-foreground">Tableau des scores</h2>
              <div className="-mx-2 min-h-0 flex-1 space-y-4 overflow-y-auto px-2 [scrollbar-width:thin]">
                <div
                  className="relative overflow-hidden rounded-xl border border-[#d9a93f]/60 bg-[#f4ecd6] bg-cover bg-center px-6 py-5 text-center text-[#1b2a2e] shadow-inner"
                  style={{ backgroundImage: "var(--image-papier)" }}
                >
                  <Couronne className="mx-auto mb-1 block h-10 w-9 bg-[#b88a2a]" />
                  <p className="font-sans text-3xl font-black tracking-[0.12em] uppercase" style={{ color: couleur(vainqueurs[0]!.joueurId) }}>
                    {vainqueurs.map((v) => info(v.joueurId)?.pseudo).join(" & ")}
                  </p>
                  <p className="mt-1 font-display text-lg text-[#6b4a1a]">{vainqueurs[0]!.total} points · Favori de la cour</p>
                  <div className="mt-3 flex flex-col items-center gap-1.5">
                    {vainqueurs.map((v) => (
                      <Detail key={v.joueurId} j={v} />
                    ))}
                  </div>
                </div>

                {autres.length > 0 && (
                  <ol className="divide-y divide-foreground/15">
                    {autres.map((j) => (
                      <li key={j.joueurId} className="space-y-1.5 py-3">
                        <div className="flex items-center justify-between text-lg">
                          <span className="flex items-center gap-3">
                            <span className="w-5 text-foreground/50 tabular-nums">{j.rang}.</span>
                            <span className="font-sans font-black tracking-[0.12em] uppercase brightness-150" style={{ color: couleur(j.joueurId) }}>
                              {info(j.joueurId)?.pseudo}
                            </span>
                          </span>
                          <span className="text-foreground/80 tabular-nums">{j.total} pts</span>
                        </div>
                        <div className="pl-8">
                          <Detail j={j} />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-center gap-5 pt-1">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <BoutonCour onClick={rejouer} occupe={envoi} disabled={dejaVote} className="w-auto max-w-none px-8">
                    Rejouer ({partie.rejouer.length}/{partie.joueurs.length})
                  </BoutonCour>
                  <button
                    type="button"
                    onClick={partager}
                    disabled={partage}
                    className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-[#f3ecd6]/40 px-5 font-display text-base tracking-wide text-foreground uppercase transition-colors hover:bg-[#f3ecd6]/10 disabled:opacity-60"
                  >
                    <Share2Icon className="size-4" />
                    Partager
                  </button>
                </div>
                <Link href="/" className="font-display text-base text-foreground/75 underline-offset-4 hover:text-foreground hover:underline">
                  Retour à l&apos;accueil
                </Link>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={onBasculer}
          className="pointer-events-auto fixed bottom-[20%] left-1/2 z-50 -translate-x-1/2 cursor-pointer rounded-full border border-[#f3ecd6]/25 bg-[#0b2231] px-6 py-2.5 font-display text-base tracking-wide text-foreground/85 uppercase shadow-[0_8px_24px_rgb(0_0_0/45%)] transition-[scale,color] hover:scale-105 hover:text-foreground"
        >
          {ouvert ? "Masquer le tableau des scores" : "Afficher le tableau des scores"}
        </button>
      </div>
    </>
  )
}
