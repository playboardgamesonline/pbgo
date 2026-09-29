import type { Results } from "@pgo/engine-kit"

export const CARD_COLORS = ["sun", "moon", "star", "comet"] as const
export type CardColor = (typeof CARD_COLORS)[number]
export const MAX_VALUE = 10

export type Card = { id: string; color: CardColor; value: number }

export type PlayedCard = { playerId: string; card: Card }

export type PlayerState = {
  id: string
  nickname: string
  hand: Card[]
  pointsPerRound: number[]
}

export type GameEvent =
  | { type: "cardPlayed"; playerId: string; card: Card }
  | { type: "trickWon"; playerId: string; cards: Card[] }
  | { type: "newRound"; round: number }

export type DemoOptions = { rounds: number; handSize: number; inverse: boolean }

export type State = {
  seed: number
  options: DemoOptions
  players: PlayerState[]
  round: number
  roundLeader: number
  activePlayer: number
  trick: PlayedCard[]
  lastTrick: { cards: PlayedCard[]; winnerId: string } | null
  phase: "playing" | "over"
  log: GameEvent[]
}

export type Action = { type: "playCard"; playerId: string; cardId: string }

export type PlayerView = {
  phase: State["phase"]
  options: DemoOptions
  round: number
  me: { id: string; hand: Card[] } | null
  players: { id: string; nickname: string; cardCount: number; points: number; pointsPerRound: number[] }[]
  activePlayerId: string | null
  trick: PlayedCard[]
  lastTrick: State["lastTrick"]
  log: GameEvent[]
  results: Results | null
}
