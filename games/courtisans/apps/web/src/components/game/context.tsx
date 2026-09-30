"use client"

import type { PlayerView } from "@courtisans/engine"
import { createContext, useContext, useMemo } from "react"
import { useGame } from "@pbgo/core/components/game/context"
import type { PublicGame } from "@pbgo/core/lib/game-types"
import type { ClientCatalog } from "@/lib/catalog"

type CourtisansContextValue = {
  catalog: ClientCatalog
  game: PublicGame
  view: PlayerView
  nickname: (playerId: string) => string
  color: (playerId: string) => string
}

const CourtisansContext = createContext<CourtisansContextValue | null>(null)

/** Contexte du plateau : partie, vue et joueurs viennent de @pbgo/core (GameProvider), plus le catalogue de Courtisans. */
export function CourtisansProvider({ catalog, view, children }: { catalog: ClientCatalog; game?: PublicGame; view: PlayerView; children: React.ReactNode }) {
  const core = useGame()
  const value = useMemo<CourtisansContextValue>(
    () => ({ catalog, game: core.game, view, nickname: core.nickname, color: core.color }),
    [catalog, core.game, view, core.nickname, core.color],
  )
  return <CourtisansContext.Provider value={value}>{children}</CourtisansContext.Provider>
}

export function useCourtisans() {
  const ctx = useContext(CourtisansContext)
  if (!ctx) throw new Error("useCourtisans hors de CourtisansProvider")
  return ctx
}
