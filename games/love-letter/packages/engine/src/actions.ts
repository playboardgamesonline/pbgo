import { EngineError, cleanChoice, reissueIds } from "@pbgo/engine-kit"
import { CARDS, type CharacterKey, GUESSES } from "./catalogue"
import { EFFECTS } from "./effects"
import { type Ctx, areaOf, close, emit, faceOf, facesOf, handOf, keyOf, open, playableOf, playerAt, refuse, removeFrom, seatOf, targetsOf, waitingFor } from "./machine"
import { endTurn, startRound } from "./round"
import { type Action, CLIENT_ACTIONS, type LoveLetterStep, type State } from "./types"

/**
 * What a player does, one function per action. Every one of them checks what it is given before it changes anything and throws an
 * `EngineError` (the codes are `LOVE_LETTER_ERROR_CODES`): `step` works on a copy, so a refusal leaves the state as it was.
 */

/**
 * The player a card picks, which must be one of the players it can pick (rulebook, pp. 5, 9-12): another player in the round who is not protected by a Handmaid for
 * the Guard, Priest, Baron and King, any player, the one who plays it included, for the Prince. Gives the seat, or `null` for a card that picks nobody and for one that
 * picks another player when there is none (p. 11: it is played with no effect, and no player may be named then).
 */
function chooseTarget(s: State, seat: number, key: CharacterKey, raw: unknown): number | null {
  const rule = CARDS[key].target
  if (rule === null) return null
  const others = targetsOf(s, seat)
  const allowed = rule === "any" ? [seat, ...others] : others
  if (allowed.length === 0) {
    if (raw !== undefined && raw !== null) throw new EngineError("INVALID_TARGET", "No player can be picked: the card is played with no effect")
    return null
  }
  const chosen = typeof raw === "string" ? seatOf(s, raw) : -1
  if (!allowed.includes(chosen)) throw new EngineError("INVALID_TARGET", "That player cannot be picked")
  return chosen
}

/**
 * `by` plays the card of their hand that `fields.card` names (rulebook, p. 4): it goes face up to their play area, its effect is resolved, then the turn ends.
 * Everything is checked before anything changes: the card is in the hand, the player it picks can be picked and a Guard names one of the nine other characters.
 */
export function play(ctx: Ctx, by: string, fields: { card?: unknown; target?: unknown; guess?: unknown }): void {
  const { s } = ctx
  if (s.stage.kind !== "play") throw refuse("play a card")
  const { card } = fields
  if (typeof card !== "number" || !Number.isInteger(card)) throw new EngineError("INVALID_ACTION", "A card is named by its id")
  const seat = seatOf(s, by)
  const hand = handOf(s, seat)
  if (!hand.includes(card)) throw new EngineError("UNKNOWN_CARD", "That card is not in your hand")
  if (!playableOf(s, seat).includes(card)) throw new EngineError("MUST_PLAY_COUNTESS", "You must play the Countess when your other card is the King or a Prince")
  const key = keyOf(s, card)
  const target = chooseTarget(s, seat, key, fields.target)
  const guess = key === "guard" && target !== null ? cleanChoice(fields.guess, GUESSES) : null
  removeFrom(hand, card)
  areaOf(s, seat).push(card)
  emit(ctx, { kind: "play", by, card: faceOf(s, card) })
  EFFECTS[key](ctx, { seat, by, target, guess })
  // a Chancellor leaves the turn to its player, who keeps a card (`keep`)
  if (s.stage.kind === "play") endTurn(ctx)
}

/**
 * After a Chancellor, `by` keeps the card `fields.card` of their hand and puts the others under the deck, face down, in the order `fields.bottom` lists them
 * (rulebook, p. 10): the first one is placed first, so the last is the last card of the deck. The cards put back were seen by their player and go back into hiding,
 * so they hold new ids that nobody has seen (`reissueIds`). Only `by` reads which cards they were. The cards put back are neither played nor discarded (the
 * reading validated for p. 10): a Princess among them knocks nobody out, a Spy among them does not count.
 */
export function keep(ctx: Ctx, by: string, fields: { card?: unknown; bottom?: unknown }): void {
  const { s } = ctx
  if (s.stage.kind !== "keep") throw refuse("keep a card")
  const { card, bottom } = fields
  if (typeof card !== "number" || !Number.isInteger(card)) throw new EngineError("INVALID_ACTION", "A card is named by its id")
  if (!Array.isArray(bottom) || bottom.some((id) => typeof id !== "number" || !Number.isInteger(id))) throw new EngineError("INVALID_ACTION", "The cards to put back are named by their ids")
  const seat = seatOf(s, by)
  const hand = handOf(s, seat)
  if (!hand.includes(card)) throw new EngineError("UNKNOWN_CARD", "That card is not in your hand")
  const others = hand.filter((id) => id !== card)
  const back = bottom as number[]
  if (back.length !== others.length || new Set(back).size !== back.length || back.some((id) => !others.includes(id))) {
    throw new EngineError("INVALID_CHOICE", "Put back the other cards of your hand, each once")
  }
  const returned = facesOf(s, back)
  const { ids, fresh } = reissueIds(s.ids, back, ctx.idsRng)
  s.ids = ids
  s.hands[seat] = [card]
  s.deck.push(...fresh)
  emit(ctx, { kind: "bottom", by, count: back.length, kept: faceOf(s, card), cards: returned }, { to: [by], masked: { kind: "bottom", by, count: back.length } })
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
      return play(ctx, by, raw)
    case "keep":
      return keep(ctx, by, raw)
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
