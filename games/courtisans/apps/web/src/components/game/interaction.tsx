"use client"

import type { Target, Courtier, PlayZone } from "@courtisans/engine"
import { createContext, useContext } from "react"

export type Assassination = { cardId: string; target: Target; candidates: string[] }

export type Interaction = {
  myTurn: boolean
  selection: Courtier | null
  select: (card: Courtier | null) => void
  assassination: Assassination | null
  canPlay: (zone: PlayZone) => boolean
  play: (target: Target) => void
  eliminate: (cardId: string | null) => void
  originOf: (cardId: string) => string | null
  sending: boolean
}

export const InteractionContext = createContext<Interaction | null>(null)

export function useInteraction() {
  const ctx = useContext(InteractionContext)
  if (!ctx) throw new Error("useInteraction hors contexte")
  return ctx
}
