"use client"

import type { ResultatJoueur, VueJoueur } from "@courtisans/engine"
import { ShareIcon } from "lucide-react"
import { ApercuPartage } from "./apercu-partage"
import { genererPartage, type LignePartage } from "./partage"
import { AnimatePresence, motion } from "motion/react"
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

function CartesFamilles({ j, grand, centre }: { j: ResultatJoueur; grand?: boolean; centre?: boolean }) {
  const { catalogue } = useJeu()
  const reussies = j.missions.filter((m) => m.validee).length
  const pointsMissions = j.missions.reduce((t, m) => t + m.points, 0)
  const taille = grand ? "h-10 w-7 text-sm" : "h-8 w-[1.4rem] text-[0.68rem]"
  const signe = (n: number) => `${n > 0 ? "+" : ""}${n}`
  return (
    <div className={cn("flex flex-wrap items-center", centre ? "justify-center" : "justify-start", grand ? "gap-2" : "gap-1.5")}>
      {j.detail
        .filter((d) => d.poids > 0)
        .map((d) => (
          <span
            key={d.famille}
            title={`${catalogue.familles[d.famille].nom} : ${signe(d.points)}`}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-[0.3rem] border border-white/20 font-display font-bold text-white/95 tabular-nums shadow-[0_3px_8px_rgb(0_0_0/30%)] [text-shadow:0_1px_2px_rgb(0_0_0/50%)]",
              taille,
            )}
            style={{ backgroundColor: `color-mix(in oklab, ${catalogue.familles[d.famille].couleur} 62%, #56686c)`, opacity: d.points === 0 ? 0.45 : 1 }}
          >
            {signe(d.points)}
          </span>
        ))}
      {reussies > 0 && (
        <span
          title={`Missions réussies : ${reussies}/${j.missions.length} (${signe(pointsMissions)})`}
          className={cn("relative ml-3 shrink-0", grand ? "h-10" : "h-9", reussies > 1 ? (grand ? "w-[5.4rem]" : "w-[5rem]") : grand ? "w-12" : "w-12")}
        >
          {j.missions
            .map((m, i) => ({ ...m, bleue: i === 1 }))
            .filter((m) => m.validee)
            .map((m, i, liste) => (
              <span
                key={m.missionId}
                className={cn(
                  "absolute flex items-center justify-center rounded-[0.3rem] border font-display font-bold tabular-nums shadow-[0_3px_8px_rgb(0_0_0/35%)]",
                  grand ? "h-8 w-12 text-sm" : "h-7 w-12 text-xs",
                  m.bleue ? "border-[#d9bf7a]/60 bg-[#0c2a31] text-[#e7cf8a]" : "border-[#cdb888]/70 bg-[#f1e8d0] text-[#3b2a08]",
                  liste.length > 1 ? (i === 0 ? "top-0 left-0 -rotate-6" : "right-0 bottom-0 rotate-[5deg]") : "inset-x-0 top-1/2 -translate-y-1/2",
                )}
              >
                {signe(m.points)}
              </span>
            ))}
        </span>
      )}
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
            className="fixed inset-0 z-40 bg-[#020c0f]/80 backdrop-blur-[2px]"
            onClick={onBasculer}
          />
        )}
      </AnimatePresence>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 bottom-[5.75rem] z-40 flex flex-col items-center justify-end px-6 pt-6"
      >
        <AnimatePresence mode="popLayout">
          {ouvert && (
            <motion.section
              key="tableau"
              role="dialog"
              aria-label="Tableau des scores"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              className="pointer-events-auto relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-[2.75rem] border border-[#f2c14e]/70 bg-[#0e3940] shadow-[0_24px_70px_rgb(0_0_0/65%),0_0_28px_rgb(242_193_78/28%),inset_0_0_18px_rgb(242_193_78/12%)]"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-(image:--image-motif) bg-[length:128px_128px] opacity-[0.07]" />
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgb(34_96_104/55%),transparent_70%)]" />
              <div className="relative shrink-0 px-8 pt-6 pb-5">
                <button
                  type="button"
                  onClick={() => setApercu(true)}
                  disabled={!image}
                  title="Partager le résultat"
                  aria-label="Partager le résultat"
                  className="group absolute top-6 right-6 z-10 w-24 rotate-[4deg] cursor-pointer rounded-md bg-[#f3ecd6] p-[3px] shadow-[0_8px_20px_rgb(0_0_0/50%)] transition-transform duration-200 hover:scale-105 hover:rotate-[1deg] disabled:cursor-wait"
                >
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-[0.2rem] bg-[#061a1e]">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="block size-full animate-pulse bg-[#12384a]" />
                    )}
                  </span>
                  <span className="absolute -right-2 -bottom-2 flex size-7 items-center justify-center rounded-full border border-[#8a6a3a]/60 bg-[#0b2231] text-foreground shadow-md transition-transform group-hover:scale-110">
                    <ShareIcon className="size-3.5" />
                  </span>
                </button>
                <div className="relative flex flex-col items-center gap-1.5 px-24 text-center">
                  <p className="font-display text-sm tracking-[0.2em] text-foreground/55 uppercase">{phrase || "Le banquet est terminé"}</p>
                  <Couronne className="relative z-10 -mt-2.5 block h-9 w-9 bg-[#f2c14e] drop-shadow-[0_0_12px_rgb(242_193_78/55%)]" />
                  <p className="font-sans text-4xl font-black tracking-[0.16em] uppercase brightness-150" style={{ color: couleur(vainqueurs[0]!.joueurId) }}>
                    {noms}
                  </p>
                  <p className="font-display text-2xl text-[#f2c14e] tabular-nums">
                    {vainqueurs[0]!.total > 0 ? "+" : ""}
                    {vainqueurs[0]!.total} pts
                  </p>
                  <div className="mt-2 space-y-2">
                    {vainqueurs.map((v) => (
                      <CartesFamilles key={v.joueurId} j={v} grand centre />
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative min-h-0 flex-1 overflow-y-auto px-8 [scrollbar-width:thin]">
                <ol className="divide-y divide-foreground/15 border-t border-foreground/15">
                  {classement
                    .filter((j) => !resultats.vainqueurs.includes(j.joueurId))
                    .map((j) => (
                      <li key={j.joueurId} className="space-y-2 py-3.5">
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-lg text-foreground/45 tabular-nums">{j.rang}.</span>
                          <span className="min-w-0 flex-1 truncate font-sans text-lg font-black tracking-[0.14em] uppercase brightness-150" style={{ color: couleur(j.joueurId) }}>
                            {info(j.joueurId)?.pseudo}
                          </span>
                          <span className="font-display text-3xl leading-none text-foreground/90 tabular-nums">
                            {j.total > 0 ? "+" : ""}
                            {j.total} pts
                          </span>
                        </div>
                        <CartesFamilles j={j} />
                      </li>
                    ))}
                </ol>
              </div>

              <div className="relative flex shrink-0 flex-col items-center gap-4 px-8 pt-5 pb-7">
                <BoutonCour onClick={rejouer} occupe={envoi} disabled={dejaVote} className="w-auto max-w-none px-8">
                  Rejouer ({partie.rejouer.length}/{partie.joueurs.length})
                </BoutonCour>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={onBasculer}
          className="pointer-events-auto fixed bottom-8 left-1/2 z-50 h-9 -translate-x-1/2 cursor-pointer rounded-lg border border-foreground/45 bg-[#0b2231]/75 px-5 font-display text-sm tracking-wide text-foreground/90 shadow-[0_6px_18px_rgb(0_0_0/40%)] backdrop-blur-sm transition-[background-color,border-color,color] duration-200 hover:border-foreground/80 hover:bg-[#0b2231]/90 hover:text-foreground"
        >
          {ouvert ? "Masquer le tableau des scores" : "Afficher le tableau des scores"}
        </button>
    </>
  )
}
