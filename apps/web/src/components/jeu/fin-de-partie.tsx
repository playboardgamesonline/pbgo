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

function CartesFamilles({ j, grand }: { j: ResultatJoueur; grand?: boolean }) {
  const { catalogue } = useJeu()
  const reussies = j.missions.filter((m) => m.validee).length
  const pointsMissions = j.missions.reduce((t, m) => t + m.points, 0)
  const taille = grand ? "h-14 w-10 text-lg" : "h-11 w-8 text-sm"
  const signe = (n: number) => `${n > 0 ? "+" : ""}${n}`
  return (
    <div className={cn("flex flex-wrap items-center justify-center", grand ? "gap-2" : "gap-1.5")}>
      {j.detail
        .filter((d) => d.poids > 0)
        .map((d) => (
          <span
            key={d.famille}
            title={`${catalogue.familles[d.famille].nom} : ${signe(d.points)}`}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md border border-white/25 font-display font-bold text-white tabular-nums shadow-[0_4px_10px_rgb(0_0_0/35%)] [text-shadow:0_1px_2px_rgb(0_0_0/60%)]",
              taille,
            )}
            style={{ backgroundColor: catalogue.familles[d.famille].couleur, opacity: d.points === 0 ? 0.5 : 1 }}
          >
            {signe(d.points)}
          </span>
        ))}
      <span
        title={`Missions : ${reussies}/${j.missions.length} réussie${reussies > 1 ? "s" : ""}`}
        className={cn(
          "ml-1 flex shrink-0 items-center justify-center rounded-md border border-[#f2c14e]/60 bg-gradient-to-b from-[#f6e7b8] to-[#e0b454] font-display font-bold text-[#3b2a08] tabular-nums shadow-[0_4px_10px_rgb(0_0_0/35%)]",
          taille,
          reussies === 0 && "opacity-45",
        )}
      >
        {signe(pointsMissions)}
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
                <p className="text-center font-display text-sm tracking-[0.2em] text-foreground/55 uppercase">{phrase || "Le banquet est terminé"}</p>
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

              <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 [scrollbar-width:thin]">
                <div className="flex flex-col items-center gap-2 pb-5 text-center">
                  <Couronne className="block h-9 w-9 bg-[#f2c14e] drop-shadow-[0_0_12px_rgb(242_193_78/55%)]" />
                  <p className="font-sans text-4xl font-black tracking-[0.16em] uppercase brightness-150" style={{ color: couleur(vainqueurs[0]!.joueurId) }}>
                    {noms}
                  </p>
                  <p className="font-display text-2xl text-[#f2c14e] tabular-nums">
                    {vainqueurs[0]!.total > 0 ? "+" : ""}
                    {vainqueurs[0]!.total} pts
                  </p>
                  <div className="mt-2 space-y-2">
                    {vainqueurs.map((v) => (
                      <CartesFamilles key={v.joueurId} j={v} grand />
                    ))}
                  </div>
                </div>
                <ol className="divide-y divide-foreground/15 border-t border-foreground/15">
                  {classement
                    .filter((j) => !resultats.vainqueurs.includes(j.joueurId))
                    .map((j) => (
                      <li key={j.joueurId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                        <span className="w-5 font-display text-lg text-foreground/45 tabular-nums">{j.rang}</span>
                        <span className="min-w-0 flex-1 truncate font-sans text-lg font-black tracking-[0.14em] uppercase brightness-150" style={{ color: couleur(j.joueurId) }}>
                          {info(j.joueurId)?.pseudo}
                        </span>
                        <CartesFamilles j={j} />
                        <span className="w-16 text-right font-display text-xl text-foreground/85 tabular-nums">{j.total} pts</span>
                      </li>
                    ))}
                </ol>
              </div>

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
