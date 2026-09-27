"use client"

import type { Cible, Courtisan, VueJoueur, ZoneJeu } from "@courtisans/engine"
import { ArrowLeftIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ReglesButton } from "@/components/regles"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { CatalogueClient } from "@/lib/catalogue"
import type { PartiePublique } from "@/lib/partie-types"
import { Bandeau } from "./bandeau"
import { JeuProvider } from "./contexte"
import { Domaine } from "./domaine"
import { FinDePartie } from "./fin-de-partie"
import { type Assassinat, type Interaction, InteractionContexte } from "./interaction"
import { Journal } from "./journal"
import { Main } from "./main"
import { MesMissions } from "./mission"
import { MissionsIntro } from "./missions-intro"
import { Pioche } from "./pioche"
import { TableReine } from "./table-reine"
import { type Vol, Vols } from "./vols"

function differences(avant: VueJoueur, apres: VueJoueur) {
  const origines: Record<string, string> = {}
  const vols: Vol[] = []
  if (apres.journal.length < avant.journal.length) return { origines, vols }
  apres.journal.slice(avant.journal.length).forEach((e, n) => {
    if (e.type === "carteJouee") origines[e.carte.id] = `chateau:${e.joueurId}`
    if (e.type === "pioche" && e.joueurId !== apres.moi?.id) {
      for (let i = 0; i < e.nombre; i++) vols.push({ id: `${avant.journal.length + n}-${i}`, joueurId: e.joueurId, delai: i * 0.12 })
    }
  })
  const avantMain = new Set(avant.moi?.main.map((c) => c.id))
  for (const c of apres.moi?.main ?? []) if (!avantMain.has(c.id)) origines[c.id] = "pioche"
  return { origines, vols }
}

export function Jeu({ partie, catalogue, onMaj, onQuitter }: { partie: PartiePublique; catalogue: CatalogueClient; onMaj: (p: PartiePublique) => void; onQuitter: () => void }) {
  const vue = partie.vue!
  const [selectionBrute, setSelection] = useState<Courtisan | null>(null)
  const [assassinat, setAssassinat] = useState<Assassinat | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [precedente, setPrecedente] = useState(vue)
  const [origines, setOrigines] = useState<Record<string, string>>({})
  const [vols, setVols] = useState<Vol[]>([])

  if (precedente !== vue) {
    const d = differences(precedente, vue)
    setOrigines(d.origines)
    if (d.vols.length) setVols((v) => [...v, ...d.vols])
    setPrecedente(vue)
  }

  const moiId = vue.moi?.id
  const monTour = vue.phase === "jeu" && !!moiId && vue.joueurActifId === moiId
  const selection = selectionBrute && vue.moi?.main.some((c) => c.id === selectionBrute.id) && monTour ? selectionBrute : null

  const interaction = useMemo<Interaction>(() => {
    async function envoyer(carteId: string, cible: Cible, cibleAssassinat?: string) {
      setEnvoi(true)
      try {
        onMaj(await api.action(partie.code, { type: "jouerCarte", carteId, cible, cibleAssassinat }))
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
      origine: (id) => origines[id] ?? null,
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
  }, [monTour, selection, assassinat, envoi, vue, origines, onMaj, partie.code])

  const index = vue.joueurs.findIndex((j) => j.id === moiId)
  const adversaires = [...vue.joueurs.slice(index + 1), ...vue.joueurs.slice(0, Math.max(0, index))].filter((j) => j.id !== moiId)

  return (
    <JeuProvider catalogue={catalogue} partie={partie} vue={vue}>
      <InteractionContexte.Provider value={interaction}>
        <main className="flex h-dvh min-h-[720px] flex-col gap-2 overflow-hidden px-4 py-2">
          <header className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            <Button variant="ghost" onClick={onQuitter}>
              <ArrowLeftIcon />
              Quitter
            </Button>
            <Bandeau />
            <ReglesButton />
          </header>

          <section className="flex flex-wrap justify-center gap-3">
            {adversaires.map((j) => (
              <Domaine key={j.id} joueurId={j.id} />
            ))}
          </section>

          <section className="flex min-h-0 flex-1 items-center justify-center gap-6">
            <TableReine />
            <Pioche />
          </section>

          <footer className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
            <div className="flex flex-col items-start gap-2">
              {moiId && <Domaine joueurId={moiId} estMoi />}
              <MesMissions />
            </div>
            <Main />
            <div className="flex justify-end">
              <Journal />
            </div>
          </footer>
        </main>

        <AnimatePresence>
          {assassinat && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit items-center gap-3 rounded-full border border-destructive bg-card/95 px-5 py-2 shadow-2xl backdrop-blur"
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

        <Vols vols={vols} onFin={(id) => setVols((v) => v.filter((x) => x.id !== id))} />
        <MissionsIntro onMaj={onMaj} />
        <FinDePartie onMaj={onMaj} />
      </InteractionContexte.Provider>
    </JeuProvider>
  )
}
