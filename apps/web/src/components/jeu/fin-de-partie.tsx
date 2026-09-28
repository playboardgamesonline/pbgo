"use client"

import type { ResultatJoueur, VueJoueur } from "@courtisans/engine"
import { Share2Icon } from "lucide-react"
import { ApercuPartage } from "./apercu-partage"
import { genererPartage, type LignePartage } from "./partage"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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
  const [image, setImage] = useState<File | null>(null)
  const [apercu, setApercu] = useState(false)
  const resultats = vue.phase === "fin" ? vue.resultats : null
  const info = (id: string) => partie.joueurs.find((j) => j.id === id)

  const cleResultats = resultats ? `${partie.code}|${resultats.vainqueurs.join()}|${resultats.joueurs.map((j) => `${j.joueurId}:${j.total}`).join()}` : null
  useEffect(() => {
    if (!resultats) return
    let annule = false
    const lignes: LignePartage[] = [...resultats.joueurs]
      .sort((a, b) => a.rang - b.rang)
      .map((j) => ({
        rang: j.rang,
        pseudo: partie.joueurs.find((x) => x.id === j.joueurId)?.pseudo ?? "?",
        couleur: couleur(j.joueurId),
        total: j.total,
        domaine: j.pointsDomaine,
        missions: j.missions.reduce((t, m) => t + m.points, 0),
        missionsReussies: j.missions.filter((m) => m.validee).length,
        familles: j.detail.filter((d) => d.poids > 0).map((d) => ({ couleur: catalogue.familles[d.famille].couleur, points: d.points })),
        vainqueur: resultats.vainqueurs.includes(j.joueurId),
      }))
    const t = setTimeout(() => {
      genererPartage(lignes, partie.code)
        .then((f) => !annule && setImage(f))
        .catch(() => !annule && toast.error("Impossible de générer l'image du résultat"))
    }, 1200)
    return () => {
      annule = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleResultats])

  const url = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  if (!resultats) return null
  const vainqueurs = resultats.joueurs.filter((j) => resultats.vainqueurs.includes(j.joueurId))
  const classement = [...resultats.joueurs].sort((a, b) => a.rang - b.rang)
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

  const textePartage = `${vainqueurs.map((v) => info(v.joueurId)?.pseudo).join(" & ")} remporte le banquet avec ${vainqueurs[0]?.total ?? 0} points !`

  return (
    <>
      <ApercuPartage fichier={apercu ? image : null} texte={textePartage} onFermer={() => setApercu(false)} />
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
              className="pointer-events-auto flex max-h-full w-full max-w-2xl flex-col gap-4 rounded-2xl border border-[#8a6a3a]/60 bg-[#0b2231]/95 p-6 shadow-[0_20px_60px_rgb(0_0_0/60%)]"
            >
              <h2 className="text-center font-display text-2xl tracking-wide text-foreground">Tableau des scores</h2>
              <div className="-mx-2 min-h-0 flex-1 space-y-4 overflow-y-auto px-2 [scrollbar-width:thin]">
                <div className="relative mx-auto aspect-[4/3] w-[min(100%,56vh)] overflow-hidden rounded-xl border border-[#d9a93f]/60 bg-[#061a1e] shadow-[0_10px_30px_rgb(0_0_0/45%)]">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="Résultat du banquet" className="block size-full object-cover" />
                  ) : (
                    <div className="flex size-full animate-pulse items-center justify-center px-6 text-center font-display text-foreground/50">
                      Le peintre de la cour immortalise le banquet…
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setApercu(true)}
                    disabled={!image}
                    title="Partager le résultat"
                    className="absolute top-3 right-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#f3ecd6]/30 bg-[#0b2231]/80 px-3 py-1.5 font-display text-sm tracking-wide text-foreground uppercase shadow-sm backdrop-blur-sm transition-[background-color,scale] hover:scale-105 hover:bg-[#0b2231] disabled:opacity-50"
                  >
                    <Share2Icon className="size-3.5" />
                    Partager
                  </button>
                </div>

                <ol className="divide-y divide-foreground/15">
                  {classement.map((j) => {
                    const gagnant = resultats.vainqueurs.includes(j.joueurId)
                    return (
                      <li key={j.joueurId} className="space-y-1.5 py-3">
                        <div className="flex items-center justify-between text-lg">
                          <span className="flex items-center gap-3">
                            {gagnant ? (
                              <Couronne className="block h-5 w-5 shrink-0 bg-[#f2c14e]" />
                            ) : (
                              <span className="w-5 text-foreground/50 tabular-nums">{j.rang}.</span>
                            )}
                            <span className="font-sans font-black tracking-[0.12em] uppercase brightness-150" style={{ color: couleur(j.joueurId) }}>
                              {info(j.joueurId)?.pseudo}
                            </span>
                          </span>
                          <span className={gagnant ? "font-semibold text-[#f2c14e] tabular-nums" : "text-foreground/80 tabular-nums"}>{j.total} pts</span>
                        </div>
                        <div className="pl-8">
                          <Detail j={j} />
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-5 pt-1">
                <BoutonCour onClick={rejouer} occupe={envoi} disabled={dejaVote} className="w-auto max-w-none px-8">
                  Rejouer ({partie.rejouer.length}/{partie.joueurs.length})
                </BoutonCour>
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
