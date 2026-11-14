import { EngineError } from "@pbgo/engine-kit"
import { type Ctx, close, emit, faceOf, gridOf, open, playerAt, refuse, revealedCount, seatOf, waitingFor } from "./machine"
import { afterOpening, dropColumn, drawCard, endTurn, startRound } from "./round"
import { columnOf, isPosition } from "./scoring"
import { type Action, CLIENT_ACTIONS, type Cell, OPENING_FLIPS, type SkyjoStep, type State } from "./types"

/**
 * What a player does, one function per action. Every one of them checks what it is given before it changes anything and throws an
 * `EngineError` (the codes are `SKYJO_ERROR_CODES`): `step` works on a copy, so a refusal leaves the state as it was.
 */

/** The cell a player names in their own grid: a position of the grid whose column is still there. */
function cellIn(s: State, seat: number, position: unknown): { cell: NonNullable<Cell>; position: number } {
  const cell = isPosition(position) ? gridOf(s, seat)[position] : undefined
  if (!isPosition(position) || cell === undefined || cell === null) throw new EngineError("INVALID_POSITION", "That is not a card of your grid")
  return { cell, position }
}

/** A cell that must be face down. */
function hiddenCell(s: State, seat: number, position: unknown): { cell: NonNullable<Cell>; position: number } {
  const found = cellIn(s, seat, position)
  if (found.cell.up) throw new EngineError("CARD_FACE_UP", "That card is already face up")
  return found
}

/** `by` turns a card of their grid over to open the round. */
export function reveal(ctx: Ctx, by: string, position: unknown): void {
  const { s } = ctx
  if (s.stage.kind !== "reveal") throw refuse("turn a card over to open the round")
  const seat = seatOf(s, by)
  if (revealedCount(s, seat) >= OPENING_FLIPS) throw new EngineError("NOT_YOUR_TURN", "You have turned your two cards over")
  const found = hiddenCell(s, seat, position)
  found.cell.up = true
  emit(ctx, { kind: "reveal", by, position: found.position, card: faceOf(s, found.cell.card), how: "opening" })
  afterOpening(ctx)
}

function stageOf<K extends "choose" | "place" | "flip">(s: State, by: string, kind: K, what: string): Extract<State["stage"], { kind: K }> & { seat: number } {
  const { stage } = s
  if (stage.kind !== kind) throw refuse(what)
  if (playerAt(s, (stage as { seat: number }).seat) !== by) throw refuse(what)
  return stage as Extract<State["stage"], { kind: K }> & { seat: number }
}

/** `by` takes the top card of the discard: they must place it. */
export function take(ctx: Ctx, by: string): void {
  const { s } = ctx
  const stage = stageOf(s, by, "choose", "take the discard")
  const card = s.discard.shift()
  if (card === undefined) throw new RangeError("The discard is never empty during a round")
  s.stage = { kind: "place", seat: stage.seat, card, from: "discard" }
  emit(ctx, { kind: "take", by, card: faceOf(s, card) })
}

/** `by` draws the top card of the draw pile: only they see it, and they place it or throw it away. */
export function draw(ctx: Ctx, by: string): void {
  const { s } = ctx
  const stage = stageOf(s, by, "choose", "draw")
  const card = drawCard(ctx)
  if (card === null) throw new EngineError("INVALID_PHASE", "The draw pile is empty: take the discard")
  s.stage = { kind: "place", seat: stage.seat, card, from: "deck" }
  emit(ctx, { kind: "draw", by, card: faceOf(s, card) }, { to: [by], masked: { kind: "draw", by } })
}

/** `by` puts the card they hold in `position`: the card that was there, face up or not, goes on the discard, then three equal cards in the column are thrown away. */
export function place(ctx: Ctx, by: string, position: unknown): void {
  const { s } = ctx
  const stage = stageOf(s, by, "place", "place a card")
  const found = cellIn(s, stage.seat, position)
  const replaced = found.cell.card
  const replacedUp = found.cell.up
  gridOf(s, stage.seat)[found.position] = { card: stage.card, up: true }
  s.discard.unshift(replaced)
  emit(ctx, { kind: "place", by, position: found.position, card: faceOf(s, stage.card), replaced: faceOf(s, replaced), replacedUp })
  finish(ctx, stage.seat, found.position)
}

/** `by` throws away the card they drew: it goes on the discard and they turn a card over. */
export function discard(ctx: Ctx, by: string): void {
  const { s } = ctx
  const stage = stageOf(s, by, "place", "throw a card away")
  if (stage.from === "discard") throw new EngineError("MUST_PLACE", "A card taken from the discard must be placed")
  s.discard.unshift(stage.card)
  s.stage = { kind: "flip", seat: stage.seat }
  emit(ctx, { kind: "discard", by, card: faceOf(s, stage.card) })
}

/** `by` turns a face-down card of their grid over, after throwing away the card they drew. */
export function flip(ctx: Ctx, by: string, position: unknown): void {
  const { s } = ctx
  const stage = stageOf(s, by, "flip", "turn a card over")
  const found = hiddenCell(s, stage.seat, position)
  found.cell.up = true
  emit(ctx, { kind: "reveal", by, position: found.position, card: faceOf(s, found.cell.card), how: "flip" })
  finish(ctx, stage.seat, found.position)
}

/** A card was put or turned over in `position`: its column is checked, then the turn is over. */
function finish(ctx: Ctx, seat: number, position: number): void {
  dropColumn(ctx, seat, columnOf(position))
  endTurn(ctx, seat)
}

/** The dealer deals the next round. */
export function dealRound(ctx: Ctx, by: string): void {
  const { s } = ctx
  if (s.stage.kind !== "between" || playerAt(s, s.dealer) !== by) throw refuse("deal")
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
    case "reveal":
      return reveal(ctx, by, raw.position)
    case "take":
      return take(ctx, by)
    case "draw":
      return draw(ctx, by)
    case "place":
      return place(ctx, by, raw.position)
    case "discard":
      return discard(ctx, by)
    case "flip":
      return flip(ctx, by, raw.position)
    case "deal":
      return dealRound(ctx, by)
  }
}

/**
 * Plays one action on `state`. Gives the new state and what happened (the events a log is made of). `state` is never touched. Throws an
 * `EngineError` when the action is refused.
 */
export function step(state: State, action: Action): SkyjoStep {
  const ctx = open(state)
  perform(ctx, action)
  return close(ctx)
}
