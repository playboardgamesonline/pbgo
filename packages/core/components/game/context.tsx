"use client"

import type { PlayerView } from "@pgo/binding"
import { createContext, useContext, useMemo } from "react"
import type { PublicGame } from "../../lib/game-types"

type GameContextValue = {
  game: PublicGame
  view: PlayerView
  nickname: (playerId: string) => string
  color: (playerId: string) => string
}

export const PLAYER_COLORS = ["#e8795a", "#9d8cf2", "#e56fa4", "#6fb4e5", "#e8b43a", "#6fd3a8"]

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ game, view, children }: { game: PublicGame; view: PlayerView; children: React.ReactNode }) {
  const value = useMemo<GameContextValue>(
    () => ({
      game,
      view,
      nickname: (id) => game.players.find((j) => j.id === id)?.nickname ?? "?",
      color: (id) => PLAYER_COLORS[Math.max(0, game.players.findIndex((j) => j.id === id)) % PLAYER_COLORS.length]!,
    }),
    [game, view],
  )
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error("useJeu hors de JeuProvider")
  return ctx
}
