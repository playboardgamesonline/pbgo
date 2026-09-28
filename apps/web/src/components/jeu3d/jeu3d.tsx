"use client"

import type { Cible, Courtisan, VueJoueur, ZoneJeu } from "@courtisans/engine"
import { Loader2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { button, useControls } from "leva"
import { boutonCopie, onglet } from "./onglets-debug"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { ReglesButton } from "@/components/regles"
import { BoutonSon } from "@/components/son"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { CatalogueClient } from "@/lib/catalogue"
import type { PartiePublique } from "@/lib/partie-types"
import { Bandeau } from "../jeu/bandeau"
import { JeuProvider } from "../jeu/contexte"
import { FinDePartie, phraseVainqueur } from "../jeu/fin-de-partie"
import { useSequenceFin } from "./fin"
import { useSonsJeu } from "./sons"
import { BoutonCour } from "../banquet/ecran-banquet"
import { useTriche } from "./triche"
import { type Assassinat, type Interaction, InteractionContexte } from "../jeu/interaction"
import { PanneauDebug } from "./debug"
import { Annonce, type TypeAnnonce, useReglagesAnnonces } from "./annonce"
import type { NomSon } from "@/lib/son"
import type { EtapeOuverture } from "./scene"

const Scene3D = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center">
      <Loader2Icon className="size-8 animate-spin text-primary" />
    </div>
  ),
})

const aLire = (vue: VueJoueur) => vue.phase === "missions" && !!vue.moi && !vue.joueurs.find((j) => j.id === vue.moi?.id)?.missionsLues

export function Jeu3D({
  partie,
  catalogue,
  onMaj,
  onQuitter,
}: {
  partie: PartiePublique
  catalogue: CatalogueClient
  onMaj: (p: PartiePublique) => void
  onQuitter: () => void
}) {
  const pseudoDe = useCallback((id: string) => partie.joueurs.find((j) => j.id === id)?.pseudo ?? "?", [partie.joueurs])
  const vue = useTriche(partie.vue!, pseudoDe)
  const partieVue = useMemo(() => ({ ...partie, vue }), [partie, vue])
  const [scoresOuverts, setScoresOuverts] = useState(true)
  const [selectionBrute, setSelection] = useState<Courtisan | null>(null)
  const [assassinat, setAssassinat] = useState<Assassinat | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [missionFocus, setMissionFocus] = useState<string | null>(null)
  const { fin, passer } = useSequenceFin(vue)
  const [etape, setEtape] = useState<EtapeOuverture>(() => (aLire(vue) ? "tapis" : null))
  const [boutonMissions, setBoutonMissions] = useState(false)
  const [repere, setRepere] = useState(`${vue.phase}:${vue.joueurActifId}`)
  const [annonces, setAnnonces] = useState<{ id: number; texte: string; son: NomSon; type: TypeAnnonce }[]>([])
  const [compteur, setCompteur] = useState(0)
  const repereActuel = `${vue.phase}:${vue.joueurActifId}`
  if (repere !== repereActuel) {
    const [phasePrec] = repere.split(":")
    setRepere(repereActuel)
    const nouvelles: { id: number; texte: string; son: NomSon; type: TypeAnnonce }[] = []
    if (vue.phase === "jeu" && phasePrec === "missions")
      nouvelles.push({ id: compteur, texte: catalogue.texteDebutBanquet, son: "victoire", type: "banquet" })
    if (vue.phase === "jeu" && vue.moi && vue.joueurActifId === vue.moi.id)
      nouvelles.push({ id: compteur + 1, texte: "C'est votre tour", son: "tour", type: "tour" })
    if (nouvelles.length) {
      setCompteur((c) => c + 2)
      setAnnonces((l) =>
        [...l.filter((x) => x.type !== "tour"), ...nouvelles].sort((x, y) => (x.type === "banquet" ? 0 : 1) - (y.type === "banquet" ? 0 : 1)),
      )
    }
    if (vue.phase === "missions" && phasePrec !== "missions" && aLire(vue)) setEtape("tapis")
  }
  const annonce = etape === null ? annonces[0] : undefined
  const reglagesAnnonces = useReglagesAnnonces()
  const dureeAnnonce = annonce ? reglagesAnnonces[annonce.type].duree : 0
  function annoncer(texte: string, son: NomSon, type: TypeAnnonce) {
    setAnnonces((l) => [...l, { id: Date.now(), texte, son, type }])
  }
  const intro = etape === "missions"
  const tourAffiche =
    vue.phase === "jeu"
      ? vue.joueurActifId
      : vue.phase === "missions" && (etape === "missions" || etape === null)
        ? (vue.premierJoueurId ?? null)
        : null
  const nbJoueurs = vue.joueurs.length

  const [reglagesOuverture] = useControls(
    "Ouverture",
    () => ({
      dureeTapis: { value: 3.2, min: 0.3, max: 6, step: 0.05, label: "durée tapis (s)" },
      pasDistribution: { value: 0.4, min: 0.05, max: 0.6, step: 0.01, label: "pas distribution (s)" },
      attenteBouton: { value: 1.6, min: 0, max: 5, step: 0.1, label: "délai bouton (s)" },
      ...boutonCopie("TRANSITION", "Ouverture"),
    }),
    onglet("TRANSITION"),
  )
  useControls(
    "Rejouer",
    {
      "Ouverture complète": button(() => {
        setBoutonMissions(false)
        setEtape("tapis")
      }),
      "Annonce banquet": button(() => annoncer(catalogue.texteDebutBanquet, "victoire", "banquet")),
      "Annonce votre tour": button(() => annoncer("C'est votre tour", "tour", "tour")),
    },
    onglet("TRANSITION"),
    [catalogue.texteDebutBanquet],
  )
  useControls(
    "Phases",
    {
      "START · nouvelle partie": button(() => commandeDebug("debut")),
      "MISSIONS LUES · tous": button(() => commandeDebug("missions")),
      "TOUR SUIVANT · joue 3 cartes": button(() => commandeDebug("tour")),
      "END · jouer jusqu'à la fin": button(() => commandeDebug("fin")),
    },
    [partie.code],
  )
  const [pret, setPret] = useState(false)
  const scenePrete = useCallback(() => setPret(true), [])
  useEffect(() => {
    if (!pret) return
    if (etape === "tapis") {
      const t = setTimeout(() => setEtape("distribution"), (reglagesOuverture.dureeTapis + 0.3) * 1000)
      return () => clearTimeout(t)
    }
    if (etape === "distribution") {
      const t = setTimeout(() => setEtape("missions"), (0.1 + nbJoueurs * 3 * reglagesOuverture.pasDistribution) * 1000 + 1300)
      return () => clearTimeout(t)
    }
    if (etape === "missions") {
      const t = setTimeout(() => setBoutonMissions(true), reglagesOuverture.attenteBouton * 1000)
      return () => clearTimeout(t)
    }
  }, [etape, nbJoueurs, pret, reglagesOuverture])

  useEffect(() => {
    if (!annonce) return
    const t = setTimeout(() => setAnnonces((l) => l.slice(1)), dureeAnnonce * 1000)
    return () => clearTimeout(t)
  }, [annonce, dureeAnnonce])

  const moiId = vue.moi?.id
  const monTour = vue.phase === "jeu" && !!moiId && vue.joueurActifId === moiId
  const selection = selectionBrute && vue.moi?.main.some((c) => c.id === selectionBrute.id) && monTour ? selectionBrute : null
  useSonsJeu(vue, fin, selection?.id ?? null, missionFocus)

  function commandeDebug(commande: "debut" | "missions" | "tour" | "fin") {
    api
      .debug(partie.code, commande)
      .then((p) => {
        onMaj(p)
        if (commande === "debut") {
          setBoutonMissions(false)
          setAnnonces([])
          setEtape("tapis")
        }
      })
      .catch((e: Error) => toast.error(e.message))
  }

  function finirIntro() {
    setBoutonMissions(false)
    setEtape(null)
    api
      .action(partie.code, { type: "lireMissions" })
      .then(onMaj)
      .catch(() => null)
  }

  const interaction = useMemo<Interaction>(() => {
    async function envoyer(carteId: string, cible: Cible, cibleAssassinat?: string) {
      setEnvoi(true)
      try {
        onMaj(
          await api.action(partie.code, {
            type: "jouerCarte",
            carteId,
            cible,
            cibleAssassinat,
          }),
        )
        setSelection(null)
        setAssassinat(null)
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setEnvoi(false)
      }
    }
    return {
      monTour,
      selection,
      selectionner: setSelection,
      assassinat,
      envoi,
      peutJouer: (zone: ZoneJeu) => monTour && vue.zonesDisponibles.includes(zone),
      origine: () => null,
      jouer: (cible) => {
        if (!selection) return
        if (selection.role === "assassin") {
          const cartes = cible.zone === "table" ? vue.table.map((p) => p.carte) : (vue.joueurs.find((j) => j.id === cible.joueurId)?.domaine ?? [])
          const candidats = cartes.filter((c) => c.role !== "garde").map((c) => c.id)
          if (candidats.length > 0) {
            setAssassinat({ carteId: selection.id, cible, candidats })
            return
          }
        }
        envoyer(selection.id, cible)
      },
      eliminer: (carteId) => {
        if (assassinat) envoyer(assassinat.carteId, assassinat.cible, carteId ?? undefined)
      },
    }
  }, [monTour, selection, assassinat, envoi, vue, onMaj, partie.code])

  return (
    <JeuProvider catalogue={catalogue} partie={partieVue} vue={vue}>
      <InteractionContexte.Provider value={interaction}>
        <main className="relative h-dvh w-full overflow-hidden bg-[#061a1e]">
          <div className="absolute inset-0">
            <Scene3D
              etape={etape}
              onPret={scenePrete}
              reglages={reglagesOuverture}
              missionFocus={missionFocus}
              fin={fin}
              onMission={(id) => setMissionFocus((f) => (f === id ? null : id))}
              onVide={() => {
                setMissionFocus(null)
                if (!assassinat) setSelection(null)
              }}
            />
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute top-0 right-0 z-10 h-[30rem] w-[52rem] max-w-full"
            style={{
              background:
                "radial-gradient(ellipse 100% 100% at 100% 0%, rgb(2 12 16 / 75%) 0%, rgb(2 12 16 / 50%) 35%, rgb(2 12 16 / 18%) 65%, transparent 100%)",
            }}
          />
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-6 pt-5 pb-8">
            <div className="pointer-events-auto flex flex-col items-center gap-1">
              <button type="button" className="w-40 transition-transform hover:scale-105 sm:w-48" title="Quitter la partie" onClick={onQuitter}>
                <Logo src={catalogue.logoUrl} />
              </button>
              <div className="flex items-center justify-center gap-1">
                <BoutonSon />
                <ReglesButton icone regles={catalogue.regles} />
              </div>
            </div>
            <Bandeau tour={tourAffiche} attente={vue.phase === "fin" ? "Fin du banquet" : catalogue.texteConvives} />
          </header>

          {intro && boutonMissions && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 20 }}
              className="absolute inset-x-0 bottom-[14%] z-20 flex justify-center"
            >
              <BoutonCour onClick={finirIntro} className="w-auto max-w-none px-10">
                {catalogue.texteBoutonMissions}
              </BoutonCour>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {annonce && <Annonce key={annonce.id} texte={annonce.texte} son={annonce.son} reglages={reglagesAnnonces[annonce.type]} />}
          </AnimatePresence>

          <PanneauDebug />

          <AnimatePresence>
            {assassinat && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                className="absolute inset-x-0 bottom-8 z-30 mx-auto w-fit"
              >
                <Button
                  size="lg"
                  disabled={envoi}
                  onClick={() => interaction.eliminer(null)}
                  className="h-12 rounded-full border border-[#ff4d4d]/70 bg-[#3a0d12] px-8 font-display text-base text-foreground shadow-[0_0_24px_rgb(255_77_77/35%)] hover:bg-[#5a1219]"
                >
                  Ne pas assassiner
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {fin?.texte && !fin.tableau && (
              <motion.div
                key="phrase"
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ type: "spring", damping: 14 }}
                className="pointer-events-none absolute inset-x-0 top-[40%] z-30 mx-auto max-w-3xl px-6 text-center font-display text-4xl leading-tight text-[#fff4d6] [text-shadow:0_0_24px_rgb(255_214_120/80%),0_0_60px_rgb(255_200_90/45%)] md:text-5xl"
              >
                {phraseVainqueur(partie, vue, catalogue)}
              </motion.div>
            )}
          </AnimatePresence>
          {fin && !fin.tableau && (
            <Button variant="ghost" size="sm" className="absolute right-4 bottom-4 z-40" onClick={passer}>
              Passer
            </Button>
          )}
          {fin?.tableau && <FinDePartie onMaj={onMaj} ouvert={scoresOuverts} onBasculer={() => setScoresOuverts((o) => !o)} />}
        </main>
      </InteractionContexte.Provider>
    </JeuProvider>
  )
}
