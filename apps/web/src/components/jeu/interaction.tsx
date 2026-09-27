"use client"

import type { Cible, Courtisan, ZoneJeu } from "@courtisans/engine"
import { createContext, useContext } from "react"

export type Assassinat = { carteId: string; cible: Cible; candidats: string[] }

export type Interaction = {
  monTour: boolean
  selection: Courtisan | null
  selectionner: (carte: Courtisan | null) => void
  assassinat: Assassinat | null
  peutJouer: (zone: ZoneJeu) => boolean
  jouer: (cible: Cible) => void
  eliminer: (carteId: string | null) => void
  origine: (carteId: string) => string | null
  envoi: boolean
}

export const InteractionContexte = createContext<Interaction | null>(null)

export function useInteraction() {
  const ctx = useContext(InteractionContexte)
  if (!ctx) throw new Error("useInteraction hors contexte")
  return ctx
}
