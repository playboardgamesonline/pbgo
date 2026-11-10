import type { Results, Standing, Step, Submissions, Timer } from "@pbgo/engine-kit"

export const CARD_COLORS = ["sun", "moon", "star", "comet"] as const
export type CardColor = (typeof CARD_COLORS)[number]
export const MAX_VALUE = 10

export type Card = { id: string; color: CardColor; value: number }

export type PlayedCard = { playerId: string; card: Card }

export type PlayerState = {
  id: string
  hand: Card[]
  pointsPerRound: number[]
}

/**
 * What happened, as plain data: the board turns it into sentences (the history of the HUD). A move says it with `step`, the platform keeps it in the log of the table and sends each player their lines of it (`useGameLog`):
 * the state holds none.
 */
export type GameEvent =
  | { type: "cardPlayed"; playerId: string; card: Card }
  | { type: "trickWon"; playerId: string; cards: Card[] }
  | { type: "newRound"; round: number }

/** What a move gives back: the new state and the events it says. */
export type DemoStep = Step<State, GameEvent>

export type DemoOptions = { rounds: number; handSize: number; inverse: boolean; bids: boolean; turnSeconds: number }

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
  /** The clock of the step the game is on, for the option `turnSeconds`: when it ends and how long it was set for. `null` without the option, between two moves that nobody told the time of, and once the game is over */
  timer: Timer | null
}

/** What the server puts on every action it plays: the time it played it at (`PlayerAction.at`) */
type Stamped = { at?: number }

/**
 * `timeout` is the clock's, a system action: the turn or the step that runs out is played for the players it was waiting for. It is not in `clientActions`, and only `SYSTEM_PLAYER` may carry it.
 */
export type Action = (
  | { type: "playCard"; playerId: string; cardId: string }
  | { type: "bid"; playerId: string; amount: number }
  | { type: "timeout"; playerId: string }
) &
  Stamped

export type PlayerView = {
  phase: State["phase"]
  options: DemoOptions
  round: number
  me: { id: string; hand: Card[]; bid: number | null } | null
  players: {
    id: string
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
  /** How long each step lasts, for a game with the option `turnSeconds`: the board draws the time left from it and from the deadline the platform gives it. `null` without the option and between two steps that nobody told the time of */
  timer: { seconds: number } | null
  /** What each player has so far, for the list of the players of the HUD */
  standings: Standing[]
  results: Results | null
}
