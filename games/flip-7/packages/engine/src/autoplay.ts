import { EngineError } from "@pbgo/engine-kit"
import { chooseTarget, dealRound, hit, stay } from "./actions"
import { type Ctx, close, effectOf, lineOf, open, playerAt, targetsOf, waitingFor } from "./machine"
import type { FrameOf, State } from "./types"

/**
 * Who gets the card an absent player holds: nothing is hidden and no randomness is needed, so the choice is plain and always the same.
 * A Freeze freezes them (they bank, and stop holding the table up); a Flip Three and a Second Chance go to the next player who can get
 * it, clockwise.
 */
function targetFor(s: State, frame: FrameOf<"target">): number {
  const n = s.seats.length
  const targets = targetsOf(s, frame)
  if (effectOf(s, frame.card) === "freeze" && targets.includes(frame.seat)) return frame.seat
  // clockwise from the holder, the holder itself last
  const clockwise = (seat: number) => (seat - frame.seat - 1 + n) % n
  const [first] = [...targets].sort((a, b) => clockwise(a) - clockwise(b))
  if (first === undefined) throw new RangeError("A card nobody can get is settled by the engine, not by a player")
  return first
}

/**
 * Plays the current step for `playerId`, who is absent. Legal and complete: the step is over when this returns.
 * - turn: they stay (they bank what they have) or, with nothing in front of them, hit
 * - an action card to give: see `targetFor`
 * - between two rounds: they deal
 * `NOT_WAITING` when the game is not waiting for them.
 */
export function autoPlay(ctx: Ctx, playerId: string): void {
  const { s } = ctx
  if (!waitingFor(s).includes(playerId)) throw new EngineError("NOT_WAITING", "The game is not waiting for this player")
  const top = s.stack.at(-1)
  if (top === undefined) {
    dealRound(ctx, playerId)
    return
  }
  if (top.kind === "turn") {
    if (lineOf(s, top.seat).length > 0) stay(ctx, playerId)
    else hit(ctx, playerId)
    return
  }
  if (top.kind === "target") {
    chooseTarget(ctx, playerId, playerAt(s, targetFor(s, top)))
    return
  }
  throw new RangeError("The round is not settled")
}

/** `GAME.autoPlayFor`: the state once `playerId` has been played for. */
export function autoPlayFor(state: State, playerId: string): State {
  const ctx = open(state)
  autoPlay(ctx, playerId)
  return close(ctx).state
}
