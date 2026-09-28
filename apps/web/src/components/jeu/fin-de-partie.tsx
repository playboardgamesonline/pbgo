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
  const { phrase } = annonceVainqueur(partie, vue, catalogue)
  const noms = vainqueurs.map((v) => info(v.joueurId)?.pseudo).join(" & ")

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
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-40 flex flex-col items-center gap-6 px-6 py-6",
          ouvert ? "justify-center" : "justify-end pb-[20vh]",
        )}
      >
        <AnimatePresence mode="popLayout">
          {ouvert && (
            <motion.section
              key="tableau"
              role="dialog"
              aria-label="Tableau des scores"
              layout
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              className="pointer-events-auto flex max-h-[calc(100dvh-9rem)] w-full max-w-xl flex-col gap-5 rounded-2xl border border-[#8a6a3a]/60 bg-[#0b2231]/95 p-6 shadow-[0_20px_60px_rgb(0_0_0/60%)]"
            >
              <div className="relative flex min-h-12 items-center justify-center px-16">
                <p className="text-center font-display text-lg text-foreground/75 italic">{phrase ? `${phrase} ${noms}` : "Le banquet est terminé"}</p>
                <button
                  type="button"
                  onClick={() => setApercu(true)}
                  disabled={!image}
                  title="Partager le résultat"
                  aria-label="Partager le résultat"
                  className="group absolute top-1/2 right-0 size-12 -translate-y-1/2 cursor-pointer overflow-hidden rounded-lg border border-[#f3ecd6]/20 bg-[#061a1e] opacity-70 transition-[opacity,scale] hover:scale-105 hover:opacity-100 disabled:cursor-wait disabled:opacity-30"
                >
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-[#061a1e]/45 text-foreground transition-colors group-hover:bg-[#061a1e]/25">
                    <Share2Icon className="size-4 drop-shadow" />
                  </span>
                </button>
              </div>

              <ol className="-mx-2 min-h-0 flex-1 space-y-3 overflow-y-auto px-2 [scrollbar-width:thin]">
                {classement.map((j) => {
                  const gagnant = resultats.vainqueurs.includes(j.joueurId)
                  const teinte = couleur(j.joueurId)
                  return (
                    <li
                      key={j.joueurId}
                      className={cn(
                        "flex items-center gap-4 rounded-xl border p-3 pl-4",
                        gagnant ? "border-[#d9a93f]/60 bg-[#d9a93f]/10" : "border-foreground/10 bg-foreground/[0.03]",
                      )}
                    >
                      <div className="flex w-6 shrink-0 justify-center">
                        {gagnant ? (
                          <Couronne className="block h-6 w-6 bg-[#f2c14e]" />
                        ) : (
                          <span className="font-display text-lg text-foreground/45 tabular-nums">{j.rang}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span aria-hidden className="text-sm" style={{ color: teinte }}>
                            ❧
                          </span>
                          <span className="truncate font-sans text-xl font-black tracking-[0.14em] uppercase brightness-150" style={{ color: teinte }}>
                            {info(j.joueurId)?.pseudo}
                          </span>
                          <span aria-hidden className="h-px min-w-6 flex-1" style={{ background: `linear-gradient(90deg, ${teinte}, transparent)` }} />
                        </div>
                        <Detail j={j} />
                      </div>
                      <div
                        className={cn(
                          "flex h-[5.4rem] w-[3.9rem] shrink-0 flex-col items-center justify-center rounded-lg border-2 shadow-[0_6px_16px_rgb(0_0_0/40%)]",
                          gagnant
                            ? "border-[#f2c14e] bg-gradient-to-b from-[#f6e7b8] to-[#e0b454] text-[#3b2a08]"
                            : "border-[#f3ecd6]/35 bg-gradient-to-b from-[#12384a] to-[#0a2130] text-foreground",
                        )}
                      >
                        <span className="font-display text-4xl leading-none font-bold tabular-nums">{j.total}</span>
                        <span className="mt-1 text-[0.65rem] tracking-[0.2em] uppercase opacity-70">pts</span>
                      </div>
                    </li>
                  )
                })}
              </ol>

              <div className="flex shrink-0 flex-col items-center gap-4">
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
        <motion.button
          layout
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          type="button"
          onClick={onBasculer}
          className="pointer-events-auto z-50 h-12 shrink-0 cursor-pointer rounded-xl bg-foreground px-8 font-display text-lg tracking-wide text-[#0b2231] shadow-[0_10px_30px_rgb(0_0_0/55%),0_0_28px_rgb(240_233_206/30%)] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98]"
        >
          {ouvert ? "Masquer le tableau des scores" : "Afficher le tableau des scores"}
        </motion.button>
      </div>
    </>
  )
}
