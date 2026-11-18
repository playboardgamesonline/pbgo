import { EngineError } from "@pbgo/engine-kit"
import { type Ctx, areaOf, close, emit, faceOf, handOf, open, playerAt, refuse, removeFrom, seatOf, waitingFor } from "./machine"
import { endTurn, startRound } from "./round"
import { type Action, CLIENT_ACTIONS, type LoveLetterStep, type State } from "./types"

/**
 * What a player does, one function per action. Every one of them checks what it is given before it changes anything and throws an
 * `EngineError` (the codes are `LOVE_LETTER_ERROR_CODES`): `step` works on a copy, so a refusal leaves the state as it was.
 */

/** `by` plays the card `card` of their hand (rulebook, p. 4): it goes face up to their play area, its effect is resolved, then the turn ends. */
export function play(ctx: Ctx, by: string, card: unknown): void {
  const { s } = ctx
  if (s.stage.kind !== "play") throw refuse("play a card")
  if (typeof card !== "number" || !Number.isInteger(card)) throw new EngineError("INVALID_ACTION", "A card is named by its id")
  const seat = seatOf(s, by)
  const hand = handOf(s, seat)
  if (!hand.includes(card)) throw new EngineError("UNKNOWN_CARD", "That card is not in your hand")
  removeFrom(hand, card)
  areaOf(s, seat).push(card)
  emit(ctx, { kind: "play", by, card: faceOf(s, card) })
  endTurn(ctx)
}

/** The player who takes the first turn deals the next round (rulebook, p. 7). */
export function dealRound(ctx: Ctx, by: string): void {
  const { s } = ctx
  if (s.stage.kind !== "between" || playerAt(s, s.turn) !== by) throw refuse("deal")
  startRound(ctx)
}

function isActionType(type: string): type is Action["type"] {
  return (CLIENT_ACTIONS as readonly string[]).includes(type)
}

/**
 * Checks, in this order: the game is not over; the action is well formed; the game waits for the player; the action belongs to what
 * the game waits for; then the action's own rules.
 */
export function perform(ctx: Ctx, input: unknown): void {
  const { s } = ctx
  if (waitingFor(s).length === 0) throw new EngineError("GAME_OVER", "The game is over")
  if (typeof input !== "object" || input === null) throw new EngineError("INVALID_ACTION", "Not an action")
  const raw = input as Record<string, unknown>
  const { playerId: by, type } = raw
  if (typeof by !== "string" || typeof type !== "string" || !isActionType(type)) throw new EngineError("INVALID_ACTION", "Not an action")
  if (!waitingFor(s).includes(by)) throw new EngineError("NOT_YOUR_TURN", "It is not your move")
  switch (type) {
    case "play":
      return play(ctx, by, raw.card)
    case "deal":
      return dealRound(ctx, by)
  }
}

/**
 * Plays one action on `state`. Gives the new state and what happened (the events a log is made of). `state` is never touched. Throws an
 * `EngineError` when the action is refused.
 */
export function step(state: State, action: Action): LoveLetterStep {
  const ctx = open(state)
  perform(ctx, action)
  return close(ctx)
}
