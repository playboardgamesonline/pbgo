"use client"

import { createContext, useContext, useMemo } from "react"
import type { CoreView } from "../../lib/binding"
import type { PublicGame } from "../../lib/game-types"
import { useSkin } from "../skin-provider"

export type GameContextValue<V extends CoreView = CoreView> = {
  game: PublicGame
  view: V
  nickname: (playerId: string) => string
  color: (playerId: string) => string
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider<V extends CoreView>({ game, view, children }: { game: PublicGame; view: V; children: React.ReactNode }) {
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

/** Game shown by the board. `V` is the game's player view: `useGame<PlayerView>()`. */
export function useGame<V extends CoreView = CoreView>() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error("useGame() needs a GameProvider above it")
  return ctx as GameContextValue<V>
}
