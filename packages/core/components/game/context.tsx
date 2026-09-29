"use client"

import type { PlayerView } from "@pgo/binding"
import { createContext, useContext, useMemo } from "react"
import type { PublicGame } from "../../lib/game-types"
import { useSkin } from "../skin-provider"

type GameContextValue = {
  game: PublicGame
  view: PlayerView
  nickname: (playerId: string) => string
  color: (playerId: string) => string
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ game, view, children }: { game: PublicGame; view: PlayerView; children: React.ReactNode }) {
  const { playerColors } = useSkin()
  const value = useMemo<GameContextValue>(
    () => ({
      game,
      view,
      nickname: (id) => game.players.find((j) => j.id === id)?.nickname ?? "?",
      color: (id) => playerColors[Math.max(0, game.players.findIndex((j) => j.id === id)) % playerColors.length]!,
    }),
    [game, view, playerColors],
  )
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error("useGame hors de GameProvider")
  return ctx
}
