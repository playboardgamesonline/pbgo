"use client"

import type { Cible, Courtisan, ZoneJeu } from "@courtisans/engine"
import { Loader2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
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
import { FinDePartie } from "../jeu/fin-de-partie"
import { type Assassinat, type Interaction, InteractionContexte } from "../jeu/interaction"
import { Journal } from "../jeu/journal"
import { PanneauDebug } from "./debug"

const Scene3D = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center">
      <Loader2Icon className="size-8 animate-spin text-primary" />
    </div>
  ),
})

const CLE_MISSIONS = "courtisans:missions-vues"

function missionsVues(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLE_MISSIONS) ?? "[]") as string[]
  } catch {
    return []
  }
}

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
  const vue = partie.vue!
  const [selectionBrute, setSelection] = useState<Courtisan | null>(null)
  const [assassinat, setAssassinat] = useState<Assassinat | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [missionFocus, setMissionFocus] = useState<string | null>(null)
  const [vues, setVues] = useState<string[]>(missionsVues)

  const cleMissions = `${partie.code}:${vue.moi?.missions.map((m) => m.id).join("+") ?? ""}`
  const intro = !!vue.moi && vue.phase !== "fin" && !vues.includes(cleMissions)

  const moiId = vue.moi?.id
  const monTour = vue.phase === "jeu" && !!moiId && vue.joueurActifId === moiId
  const selection = selectionBrute && vue.moi?.main.some((c) => c.id === selectionBrute.id) && monTour ? selectionBrute : null

  function finirIntro() {
    const suivantes = [...vues.slice(-20), cleMissions]
    setVues(suivantes)
    try {
      localStorage.setItem(CLE_MISSIONS, JSON.stringify(suivantes))
    } catch {}
    api.action(partie.code, { type: "lireMissions" }).catch(() => null)
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
    <JeuProvider catalogue={catalogue} partie={partie} vue={vue}>
      <InteractionContexte.Provider value={interaction}>
        <main className="relative h-dvh w-full overflow-hidden bg-[#061a1e]">
          <div className="absolute inset-0">
            <Scene3D
              intro={intro}
              missionFocus={missionFocus}
              onMission={(id) => (intro ? finirIntro() : setMissionFocus((f) => (f === id ? null : id)))}
              onVide={() => {
                setMissionFocus(null)
                if (!assassinat) setSelection(null)
              }}
            />
          </div>

          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-6 pt-5 pb-8">
            <div className="flex flex-col items-start gap-3">
              <button
                type="button"
                className="pointer-events-auto mt-1 w-28 transition-transform hover:scale-105 sm:w-36"
                title="Quitter la partie"
                onClick={onQuitter}
              >
                <Logo src={catalogue.logoUrl} />
              </button>
              <Bandeau />
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              <BoutonSon />
              <ReglesButton icone />
            </div>
          </header>

          {intro && (
            <div className="absolute inset-x-0 bottom-[12%] z-20 flex justify-center">
              <Button size="lg" className="h-12 px-8 font-display text-base shadow-2xl" onClick={finirIntro}>
                J&apos;ai lu mes missions
              </Button>
            </div>
          )}

          <Journal />
          <PanneauDebug />

          <AnimatePresence>
            {assassinat && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                className="absolute inset-x-0 bottom-[28%] z-30 mx-auto flex w-fit items-center gap-3 rounded-full border border-destructive bg-card/95 px-5 py-2 shadow-2xl backdrop-blur"
              >
                <span className="text-sm">Ton Assassin peut éliminer une carte de cette zone (sauf les Gardes).</span>
                <Button size="sm" variant="secondary" disabled={envoi} onClick={() => interaction.eliminer(null)}>
                  Ne pas éliminer
                </Button>
                <Button size="sm" variant="ghost" disabled={envoi} onClick={() => setAssassinat(null)}>
                  Annuler
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <FinDePartie onMaj={onMaj} />
        </main>
      </InteractionContexte.Provider>
    </JeuProvider>
  )
}
