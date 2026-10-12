import type { Results, Submissions } from "@pbgo/engine-kit"

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

export type DemoOptions = { rounds: number; handSize: number; inverse: boolean; bids: boolean }

export type State = {
  seed: number
  options: DemoOptions
  players: PlayerState[]
  round: number
  roundLeader: number
  activePlayer: number
  trick: PlayedCard[]
  lastTrick: { cards: PlayedCard[]; winnerId: string } | null
  /** `bidding`: the simultaneous step at the start of a round (option `bids`), then `playing`, one player at a time */
  phase: "bidding" | "playing" | "over"
  /** Number of tricks each player announced for the round, `null` until they did. Secret while the phase is `bidding`; empty without the `bids` option */
  bids: Submissions<number>
  log: GameEvent[]
}

export type Action = { type: "playCard"; playerId: string; cardId: string } | { type: "bid"; playerId: string; amount: number }

export type PlayerView = {
  phase: State["phase"]
  options: DemoOptions
  round: number
  me: { id: string; hand: Card[]; bid: number | null } | null
  players: {
    id: string
    nickname: string
    cardCount: number
    points: number
    pointsPerRound: number[]
    /** Public: the player has announced their bid (their own bid is only known to them until everybody has) */
    hasBid: boolean
    /** Revealed once everybody has bid, `null` before */
    bid: number | null
  }[]
  activePlayerId: string | null
  trick: PlayedCard[]
  lastTrick: State["lastTrick"]
  log: GameEvent[]
  results: Results | null
}
