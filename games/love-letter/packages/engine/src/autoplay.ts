import { EngineError } from "@pbgo/engine-kit"
import { dealRound, play } from "./actions"
import { CARDS, type CharacterKey, GUESSES } from "./catalogue"
import { type Ctx, close, keyOf, open, playableOf, playerAt, targetsOf, valueOf, waitingFor } from "./machine"
import type { LoveLetterStep, State } from "./types"

/**
 * Playing for an absent player: legal, deterministic and complete (the whole turn, not one click), with the plainest strategy that keeps the table moving. It
 * plays the card of the lowest value that may be played, the first in hand when two are worth the same, so the Princess is the last card it would play. A card
 * that picks a player picks the first one who can be picked clockwise after them (their own player only when a Prince has nobody else), and a Guard names the
 * first character that is not the Guard. Every turn takes a card from the deck, so a round always ends; between two rounds it deals.
 */

/** The card of the lowest value among `ids`, the first one when two are worth the same. */
function lowestOf(s: State, ids: readonly number[]): number {
  const [first, ...rest] = ids
  if (first === undefined) throw new RangeError("A player who plays has a card to play")
  let choice = first
  for (const id of rest) if (valueOf(s, id) < valueOf(s, choice)) choice = id
  return choice
}

/** The player a card of `seat` picks: the first who can be picked clockwise after `seat`, `seat` itself when a Prince has nobody else, nobody for a card that picks nobody. */
function targetFor(s: State, seat: number, key: CharacterKey): number | undefined {
  const rule = CARDS[key].target
  if (rule === null) return undefined
  const n = s.seats.length
  const [first] = targetsOf(s, seat).sort((a, b) => ((a - seat + n) % n) - ((b - seat + n) % n))
  return first ?? (rule === "any" ? seat : undefined)
}

/**
 * Plays the current step for `playerId`, who is absent. Legal and complete: the step is over when this returns.
 * `NOT_WAITING` when the game is not waiting for them.
 */
export function autoPlay(ctx: Ctx, playerId: string): void {
  const { s } = ctx
  if (!waitingFor(s).includes(playerId)) throw new EngineError("NOT_WAITING", "The game is not waiting for this player")
  if (s.stage.kind === "between") return dealRound(ctx, playerId)
  const card = lowestOf(s, playableOf(s, s.turn))
  const key = keyOf(s, card)
  const target = targetFor(s, s.turn, key)
  play(ctx, playerId, { card, target: target === undefined ? undefined : playerAt(s, target), guess: key === "guard" ? GUESSES[0] : undefined })
}

/** `GAME.autoPlayStep`: the state once `playerId` has been played for, and what happened. */
export function autoPlayStep(state: State, playerId: string): LoveLetterStep {
  const ctx = open(state)
  autoPlay(ctx, playerId)
  return close(ctx)
}

/** `GAME.autoPlayFor`: the state once `playerId` has been played for. */
export function autoPlayFor(state: State, playerId: string): State {
  return autoPlayStep(state, playerId).state
}
