"use client"

import type { Resultats, VueJoueur } from "@courtisans/engine"
import { useControls } from "leva"
import { useMemo } from "react"

export const AUCUN = "—"

export function tricher(resultats: Resultats, gagnant: string): Resultats {
  const cible = resultats.joueurs.find((j) => j.joueurId === gagnant)
  if (!cible) return resultats
  const meilleur = Math.max(...resultats.joueurs.filter((j) => j.joueurId !== gagnant).map((j) => j.total), 0)
  const bonus = Math.max(0, meilleur - cible.total + 3)
  const joueurs = resultats.joueurs
    .map((j) =>
      j.joueurId === gagnant ? { ...j, missions: [...j.missions, { missionId: "triche", validee: true, points: bonus }], total: j.total + bonus } : j,
    )
    .sort((a, b) => b.total - a.total)
  for (const j of joueurs) j.rang = 1 + joueurs.filter((o) => o.total > j.total).length
  const top = joueurs[0]!.total
  return { ...resultats, joueurs, vainqueurs: joueurs.filter((j) => j.total === top).map((j) => j.joueurId) }
}

export function useTriche(vue: VueJoueur, pseudo: (id: string) => string): VueJoueur {
  const options = useMemo(() => Object.fromEntries([[AUCUN, AUCUN], ...vue.joueurs.map((j) => [pseudo(j.id), j.id])]), [vue.joueurs, pseudo])
  const { gagnant } = useControls("Triche", { gagnant: { options, value: AUCUN, label: "faire gagner" } }, [options])
  return useMemo(() => {
    if (!vue.resultats || gagnant === AUCUN) return vue
    return { ...vue, resultats: tricher(vue.resultats, gagnant as string) }
  }, [vue, gagnant])
}
