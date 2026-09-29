import type { OptionDefinitions, OptionValues } from "./options"

export type PlayerInfo = { id: string; nickname: string }

export type PlayerAction = { type: string; playerId: string }

export type PlayerResult = {
  playerId: string
  total: number
  rank: number
  detail: { key: string; label: string; points: number }[]
}

export type Results = { players: PlayerResult[]; winners: string[] }

export type GameDefinition<State, Action extends PlayerAction, View> = {
  id: string
  name: string
  minPlayers: number
  maxPlayers: number
  options: OptionDefinitions
  clientActions: readonly Action["type"][]
  setup: (args: { players: PlayerInfo[]; options: OptionValues; seed?: number }) => State
  apply: (state: State, action: Action) => State
  view: (state: State, playerId: string | null) => View
  isOver: (state: State) => boolean
  debug?: Partial<Record<DebugCommand, (state: State) => State>>
}

export type DebugCommand = "turn" | "over"
