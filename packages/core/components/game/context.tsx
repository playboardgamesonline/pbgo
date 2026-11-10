"use client"

import { createContext, useContext, useMemo } from "react"
import type { CoreView } from "../../lib/binding"
import type { LogLine, PublicGame } from "../../lib/game-types"
import { seatColor } from "../../lib/seat-avatar"
import { useSkin } from "../skin-provider"

export type GameContextValue<V extends CoreView = CoreView> = {
  game: PublicGame
  view: V
  nickname: (playerId: string) => string
  color: (playerId: string) => string
  /** The player's account picture (PLT-13); null until accounts exist: the seat label then generates the avatar */
  avatarUrl: (playerId: string) => string | null
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider<V extends CoreView>({ game, view, children }: { game: PublicGame; view: V; children: React.ReactNode }) {
  const { playerColors } = useSkin()
  const value = useMemo<GameContextValue>(
    () => ({
      game,
      view,
      nickname: (id) => game.players.find((j) => j.id === id)?.nickname ?? "?",
      color: (id) => seatColor(game.players, id, playerColors),
      avatarUrl: (id) => game.players.find((j) => j.id === id)?.avatarUrl ?? null,
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

/**
 * The log of the table as this player reads it, oldest first: what happened in the game (`PublicGame.log`), at most the last lines. `E` is the game's event type, `useGameLog<Flip7Event>()`. Each line has the version of the table that
 * its move produced (`v`): a board that plays what is new keeps the greatest `v` it has played, and plays the lines with a greater one. A game that says nothing of what its moves did has an empty log.
 */
export function useGameLog<E = unknown>() {
  return useGame().game.log as LogLine<E>[]
}
