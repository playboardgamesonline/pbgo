"use client"

import type { PlayerView } from "@courtisans/engine"
import { createContext, useContext, useMemo } from "react"
import { useGame } from "@pbgo/core/components/game/context"
import type { PublicGame } from "@pbgo/core/lib/game-types"
import type { ClientCatalog } from "../../lib/catalog"

type CourtisansContextValue = {
  catalog: ClientCatalog
  game: PublicGame
  view: PlayerView
  nickname: (playerId: string) => string
  color: (playerId: string) => string
  /** The account's picture (PLT-13); null: the avatar is generated */
  avatarUrl: (playerId: string) => string | null
}

const CourtisansContext = createContext<CourtisansContextValue | null>(null)

/** Board context: game, view and players come from @pbgo/core (GameProvider), plus the Courtisans catalog. */
export function CourtisansProvider({ catalog, view, children }: { catalog: ClientCatalog; game?: PublicGame; view: PlayerView; children: React.ReactNode }) {
  const core = useGame<PlayerView>()
  const value = useMemo<CourtisansContextValue>(
    () => ({ catalog, game: core.game, view, nickname: core.nickname, color: core.color, avatarUrl: core.avatarUrl }),
    [catalog, core.game, view, core.nickname, core.color, core.avatarUrl],
  )
  return <CourtisansContext.Provider value={value}>{children}</CourtisansContext.Provider>
}

export function useCourtisans() {
  const ctx = useContext(CourtisansContext)
  if (!ctx) throw new Error("useCourtisans() needs a CourtisansProvider above it")
  return ctx
}
