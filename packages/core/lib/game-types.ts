import { type State, GAME, type PlayerInfo, type OptionValues, type PlayerView } from "@pbgo/binding"

export const MAX_PLAYERS = GAME.maxPlayers
export const MIN_PLAYERS = GAME.minPlayers

export type GameStatus = "lobby" | "playing" | "over"

export type PublicGame = {
  code: string
  hostId: string
  status: GameStatus
  players: PlayerInfo[]
  meId: string | null
  options: OptionValues
  replay: string[]
  /** Joueurs ayant voté pour jouer à la place du joueur absent (état courant) */
  takeoverVotes?: string[]
  version: number
  /** Dernière écriture (ISO) : sert à repérer un tour bloqué par un joueur absent */
  updatedAt?: string | null
  /** Création de la partie (ISO) : sert au pied du tableau des scores */
  createdAt?: string | null
  view: PlayerView | null
}

export type GameState = State

// Le schéma évite qu'un même code de partie croise deux jeux sur le projet Supabase partagé.
export const gameChannel = (code: string) => `game:${process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public"}:${code}`
export const UPDATE_EVENT = "maj"

