"use client"

import { Leva, LevaPanel, button, useControls } from "leva"
import { useEffect, useState, useSyncExternalStore } from "react"
import { cn } from "@/lib/utils"
import { boutonCopie, MAGASINS_DEBUG, ONGLETS_DEBUG, type OngletDebug, onglet } from "./onglets-debug"
import { changerMusique, musiqueActuelle, type NomMusique, reglerVolumes, type Volumes, VOLUMES_DEFAUT, volumesActuels } from "@/lib/son"

const CLE = "courtisans:debug"
const abonnes = new Set<() => void>()

function lire() {
  try {
    return new URLSearchParams(window.location.search).has("debug") || localStorage.getItem(CLE) === "1"
  } catch {
    return false
  }
}

function basculer() {
  try {
    localStorage.setItem(CLE, lire() ? "0" : "1")
    const url = new URL(window.location.href)
    if (url.searchParams.has("debug")) {
      url.searchParams.delete("debug")
      window.history.replaceState(null, "", url)
    }
  } catch {}
  abonnes.forEach((f) => f())
}

function copierTout() {
  const valeurs: Record<string, Record<string, unknown>> = {}
  for (const nom of ONGLETS_DEBUG) {
    const donnees = MAGASINS_DEBUG[nom].getData() as Record<string, { type?: string; value?: unknown }>
    for (const [chemin, entree] of Object.entries(donnees)) {
      if (!entree || entree.type === "BUTTON" || entree.value === undefined) continue
      ;(valeurs[nom] ??= {})[chemin] = entree.value
    }
  }
  const texte = JSON.stringify(valeurs, null, 2)
  navigator.clipboard?.writeText(texte).catch(() => null)
  console.info("Réglages debug", valeurs)
}

export function PanneauDebug() {
  useControls({ "Copier tous les réglages": button(copierTout) })
  const [ongletActif, setOnglet] = useState<OngletDebug>("GAME")
  const [, reglerSon] = useControls(
    "Son",
    () => {
      const v = volumesActuels()
      const curseur = (cle: keyof Volumes, label: string) => ({
        value: v[cle],
        min: 0,
        max: 1,
        step: 0.01,
        label,
        onChange: (x: number) => reglerVolumes({ [cle]: x }),
      })
      return {
        general: curseur("general", "général"),
        musique: curseur("musique", "musique"),
        effets: curseur("effets", "effets"),
        ambiance: curseur("ambiance", "ambiance repas"),
        piste: {
          value: musiqueActuelle(),
          options: { Danse: "danse", Estampie: "estampie", Pavane: "pavane", Branle: "branle" },
          label: "morceau",
          onChange: (m: NomMusique) => changerMusique(m),
        },
      }
    },
    onglet("AUDIO"),
  )
  useControls("Son", { "Réinitialiser le son": button(() => reglerSon(VOLUMES_DEFAUT)), ...boutonCopie("AUDIO", "Son") }, onglet("AUDIO"))
  const actif = useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    lire,
    () => false,
  )

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === "d" && !(e.target instanceof HTMLInputElement)) basculer()
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [])

  return (
    <div className={cn("absolute top-44 left-4 z-40 w-80", !actif && "hidden")}>
      <div className="flex gap-px overflow-hidden rounded-t-md bg-[#292d39] font-mono text-[10px] tracking-wider">
        {ONGLETS_DEBUG.map((nom) => (
          <button
            key={nom}
            type="button"
            onClick={() => setOnglet(nom)}
            className={cn("flex-1 py-2 text-[#8c92a4] hover:text-white", ongletActif === nom && "bg-[#181c20] text-white")}
          >
            {nom}
          </button>
        ))}
      </div>
      <Leva hidden />
      {actif && (
        <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-b-md bg-[#181c20] [scrollbar-width:thin]">
          <LevaPanel
            key={ongletActif}
            store={MAGASINS_DEBUG[ongletActif]}
            fill
            flat
            collapsed={false}
            titleBar={{ title: "Debug · Shift+D", filter: false }}
          />
        </div>
      )}
    </div>
  )
}
