import { EngineError } from "@pbgo/engine-kit"
import { defuse, draw, give, pick, pickable } from "./actions"
import type { CardKind } from "./catalogue"
import { type Ctx, close, handOf, kindOf, open, waitingFor } from "./machine"
import type { Rules } from "./rules"
import type { State } from "./types"
import { closeWindow } from "./window"

/** What an absent player gives away first, going down the list: the cards they are least likely to need. */
const GIVE_ORDER: readonly CardKind[] = ["cat", "action", "nope", "defuse"]
/** What they take from the discard first, going down the list. */
const PICK_ORDER: readonly CardKind[] = ["defuse", "nope", "action", "cat"]

/** One of the cards of the first kind of `order` that `ids` holds, picked with the game's stream (so a replay picks the same). */
function choose(ctx: Ctx, ids: readonly number[], order: readonly CardKind[]): number {
  const kind = order.find((k) => ids.some((id) => kindOf(ctx, id) === k))
  const group = kind === undefined ? ids : ids.filter((id) => kindOf(ctx, id) === kind)
  const id = group[Math.floor(ctx.rng() * group.length)]
  if (id === undefined) throw new RangeError("Nothing to choose from")
  return id
}

/**
 * Plays the current step for `playerId`, who is absent. Legal and complete: the step is over when this returns.
 * - turn: they draw (no card played, so the turn ends)
 * - Nope window: it closes, whoever has not answered yet is taken to have passed
 * - Kitten to put back: at a random position
 * - Favor: they give the card they need least
 * - five different cards: they take the card they need most
 * `NOT_WAITING` when the game is not waiting for them.
 */
export function autoPlay(ctx: Ctx, playerId: string): void {
  const { s } = ctx
  if (!waitingFor(s).includes(playerId)) throw new EngineError("NOT_WAITING", "The game is not waiting for this player")
  const { phase } = s
  switch (phase.kind) {
    case "turn":
      draw(ctx, playerId)
      return
    case "reaction":
      // One absent responder closes the window for all of them. The players who vote for the takeover are the ones who are
      // present: nothing is taken from somebody who is still there, since a Nope waits for no vote
      closeWindow(ctx)
      return
    case "defuse":
      defuse(ctx, playerId, Math.floor(ctx.rng() * (s.deck.length + 1)), phase)
      return
    case "give":
      give(ctx, playerId, choose(ctx, handOf(s, playerId), GIVE_ORDER), phase)
      return
    case "pick": {
      const eligible = pickable(ctx, phase)
      if (eligible.length === 0) throw new EngineError("EMPTY_DISCARD", "Nothing to take from the discard")
      pick(ctx, playerId, choose(ctx, eligible, PICK_ORDER), phase)
      return
    }
    case "over":
      throw new EngineError("GAME_OVER", "The game is over")
  }
}

/** `GAME.autoPlayFor`: the state once `playerId` has been played for. */
export function autoPlayFor(rules: Rules, state: State, playerId: string): State {
  const ctx = open(rules, state)
  autoPlay(ctx, playerId)
  return close(ctx).state
}
