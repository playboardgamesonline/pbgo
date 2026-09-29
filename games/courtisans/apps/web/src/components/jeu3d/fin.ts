"use client"

import type { VueJoueur } from "@courtisans/engine"
import { button, useControls } from "leva"
import { useEffect, useState } from "react"

export type EtatFin = {
  espionsTable: "cache" | "retourne" | "range"
  familles: number
  domaines: boolean
  pile: number
  missions: boolean
  noir: boolean
  projecteur: boolean
  texte: boolean
  tableau: boolean
}

export const NOMBRE_FAMILLES_TABLE = 6

const DEPART: EtatFin = {
  espionsTable: "cache",
  familles: 0,
  domaines: false,
  pile: 0,
  missions: false,
  noir: false,
  projecteur: false,
  texte: false,
  tableau: false,
}

const FINAL: EtatFin = {
  espionsTable: "range",
  familles: NOMBRE_FAMILLES_TABLE,
  domaines: true,
  pile: 99,
  missions: true,
  noir: true,
  projecteur: true,
  texte: true,
  tableau: true,
}

function programme(piles: number): [number, Partial<EtatFin>][] {
  const etapes: [number, Partial<EtatFin>][] = [
    [900, { espionsTable: "retourne" }],
    [2100, { espionsTable: "range" }],
  ]
  for (let i = 1; i <= NOMBRE_FAMILLES_TABLE; i++) etapes.push([2200 + i * 950, { familles: i }])
  let t = 2200 + NOMBRE_FAMILLES_TABLE * 950 + 1300
  etapes.push([t, { domaines: true }])
  t += 1500
  for (let p = 1; p <= piles; p++) etapes.push([t + (p - 1) * 750, { pile: p }])
  t += piles * 750 + 400
  etapes.push([t, { missions: true }])
  etapes.push([t + 1800, { noir: true }])
  etapes.push([t + 3000, { projecteur: true }])
  etapes.push([t + 4000, { texte: true }])
  etapes.push([t + 8500, { tableau: true }])
  return etapes
}

export function useSequenceFin(vue: VueJoueur) {
  const actif = vue.phase === "fin" && !!vue.resultats
  const piles = Math.max(0, ...(vue.resultats?.joueurs.map((j) => j.detail.length) ?? [0]))
  const [etat, setEtat] = useState<EtatFin>(DEPART)
  const [lecture, setLecture] = useState(0)
  const etapes = programme(piles)

  useEffect(() => {
    if (!actif || lecture < 0) return
    const minuteurs = [setTimeout(() => setEtat(DEPART), 0)]
    for (const [t, maj] of programme(piles)) minuteurs.push(setTimeout(() => setEtat((e) => (e.tableau ? e : { ...e, ...maj })), t))
    return () => minuteurs.forEach(clearTimeout)
  }, [actif, piles, lecture])

  useControls(
    "End Sequence",
    {
      Replay: button(() => setLecture((l) => Math.abs(l) + 1)),
      etape: {
        label: "step",
        value: 0,
        min: 0,
        max: etapes.length,
        step: 1,
        onChange: (n: number, _chemin: string, ctx: { initial: boolean }) => {
          if (ctx.initial) return
          setLecture((l) => -Math.abs(l) - 1)
          setEtat(etapes.slice(0, n).reduce<EtatFin>((e, [, maj]) => ({ ...e, ...maj }), DEPART))
        },
      },
    },
    { render: () => actif },
    [actif, etapes.length],
  )

  return { fin: actif ? etat : null, passer: () => setEtat(FINAL) }
}
