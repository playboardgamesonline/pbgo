import { EngineError } from "@pbgo/engine-kit"
import { type Ctx, close, lineOf, open, playerAt, refuse, roundScore, seatOf, targetsOf, waitingFor } from "./machine"
import { giveCard, receive, run, startRound } from "./round"
import { type Action, CLIENT_ACTIONS, type FrameOf, type State, type Step } from "./types"

/**
 * What a player does, one function per action. Every one of them checks what it is given before it changes anything and throws an
 * `EngineError` (the codes are `FLIP7_ERROR_CODES`): `step` works on a copy, so a refusal leaves the state as it was.
 */

/** The turn of `by`, which has not acted yet. */
function turnOf(s: State, by: string): FrameOf<"turn"> {
  const frame = s.stack.at(-1)
  if (frame?.kind !== "turn" || frame.acted || playerAt(s, frame.seat) !== by) throw refuse("hit or stay")
  return frame
}

/** `by` hits: a card is turned over in front of them, which ends their turn unless it sets off a Freeze, a Flip Three or a Second Chance to give. */
export function hit(ctx: Ctx, by: string): void {
  const frame = turnOf(ctx.s, by)
  frame.acted = true
  receive(ctx, frame.seat, { how: "hit" })
  run(ctx)
}

/** `by` stays: the cards in front of them are banked and they leave the round. They need at least one card. */
export function stay(ctx: Ctx, by: string): void {
  const { s } = ctx
  const frame = turnOf(s, by)
  if (lineOf(s, frame.seat).length === 0) throw new EngineError("CANNOT_STAY", "You have no card in front of you: hit")
  s.status[frame.seat] = "stayed"
  frame.acted = true
  ctx.events.push({ event: { kind: "stay", by, points: roundScore(s, frame.seat) } })
  run(ctx)
}

/** `by` gives the action card they hold to `target`. */
export function chooseTarget(ctx: Ctx, by: string, target: unknown): void {
  const { s } = ctx
  const frame = s.stack.at(-1)
  if (frame?.kind !== "target" || playerAt(s, frame.seat) !== by) throw refuse("choose a target")
  const seat = typeof target === "string" ? seatOf(s, target) : -1
  if (seat < 0 || !targetsOf(s, frame).includes(seat)) throw new EngineError("INVALID_TARGET", "That player cannot get this card")
  giveCard(ctx, frame, seat)
  run(ctx)
}

/** The dealer deals the next round. */
export function dealRound(ctx: Ctx, by: string): void {
  const { s } = ctx
  if (s.stack.length > 0 || playerAt(s, s.dealer) !== by) throw refuse("deal")
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

  const top = s.stack.at(-1)
  switch (type) {
    case "hit":
      if (top?.kind !== "turn") throw refuse("hit")
      hit(ctx, by)
      return
    case "stay":
      if (top?.kind !== "turn") throw refuse("stay")
      stay(ctx, by)
      return
    case "target":
      if (top?.kind !== "target") throw refuse("choose a target")
      chooseTarget(ctx, by, raw.target)
      return
    case "deal":
      if (top !== undefined) throw refuse("deal")
      dealRound(ctx, by)
      return
  }
}

/**
 * Plays one action on `state`. Gives the new state and what happened (the events a log is made of). `state` is never touched. Throws an
 * `EngineError` when the action is refused.
 */
export function step(state: State, action: Action): Step {
  const ctx = open(state)
  perform(ctx, action)
  return close(ctx)
}
