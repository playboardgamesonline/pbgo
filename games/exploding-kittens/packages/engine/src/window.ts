import { EngineError, allSubmitted, openSubmissions, submit } from "@pbgo/engine-kit"
import { resolveCombo } from "./combos"
import { type Ctx, close, effectOf, emit, faceOf, handOf, kindOf, livingIds, open, removeFrom, seatOf, typeOf } from "./machine"
import type { Rules } from "./rules"
import type { PhaseOf, State, Step } from "./types"

/**
 * The Nope window. Every action card and every combo opens one on itself, and the cards are on the discard from the start. Every
 * living player but the author of the last card of the chain may answer, by playing a Nope or by passing. A Nope joins the chain,
 * restarts the window and clears the passes; its author cannot answer their own Nope, everyone else can, the original author too.
 * The window closes when all of the players it waits for have passed (or when `resolveWindow` closes it, see below), and the
 * action goes through if the chain holds an even number of Nopes, not if it holds an odd number.
 *
 * Nothing else opens a window: not a draw, an Exploding Kitten, a Defuse and where it puts the Kitten back, the card a Favor gives,
 * nor the card taken from the discard.
 */

/** The window, for a player it waits for. `chain` is the number of Nopes the client saw: a different one means it is late. */
function responding(ctx: Ctx, playerId: string, chain: number): PhaseOf<"reaction"> {
  const { phase } = ctx.s
  if (phase.kind !== "reaction" || !Object.hasOwn(phase.passed, playerId)) throw new EngineError("NOT_WAITING", "Nothing to answer")
  if (chain !== phase.nopes.length) throw new EngineError("STALE_REACTION", "The chain moved: look again")
  return phase
}

/** `by` answers the chain with the Nope `card`. */
export function nope(ctx: Ctx, by: string, card: number, chain: number): void {
  const { s } = ctx
  const phase = responding(ctx, by, chain)
  const hand = handOf(s, by)
  if (!hand.includes(card)) throw new EngineError("UNKNOWN_CARD", "That card is not in your hand")
  if (kindOf(ctx, card) !== "nope") throw new EngineError("NO_NOPE", "That card is not a Nope")
  removeFrom(hand, card)
  s.discard.unshift(card)
  phase.nopes.push({ card, by })
  phase.passed = openSubmissions<true>(livingIds(s).filter((id) => id !== by))
  s.stats[seatOf(s, by)]!.nopes += 1
  emit(ctx, { kind: "nope", by, card: faceOf(ctx, card) })
}

/** `by` lets the chain stand. The window closes once everyone it waits for has passed. Nobody sees who passed, and no event says so. */
export function pass(ctx: Ctx, by: string, chain: number): void {
  const phase = responding(ctx, by, chain)
  if (phase.passed[by] === true) throw new EngineError("ALREADY_PASSED", "You passed already")
  phase.passed = submit(phase.passed, by, true)
  if (allSubmitted(phase.passed)) closeWindow(ctx)
}

/**
 * Closes the open window, whoever has answered: the chain decides. An odd number of Nopes cancels the action (its cards stay on
 * the discard, nothing happens); an even number lets it resolve. Does nothing when no window is open.
 */
export function closeWindow(ctx: Ctx): void {
  const { s } = ctx
  const { phase } = s
  if (phase.kind !== "reaction") return
  const { pending } = phase
  s.phase = { kind: "turn" }
  if (phase.nopes.length % 2 === 1) {
    emit(ctx, { kind: "cancelled", by: pending.by })
    return
  }
  emit(ctx, { kind: "resolved", by: pending.by })
  if (pending.kind === "combo") {
    resolveCombo(ctx, pending)
    return
  }
  const play: { by: string; target?: string } = { by: pending.by }
  if (pending.target !== undefined) play.target = pending.target
  effectOf(ctx.rules, typeOf(ctx, pending.card)).resolve(ctx, play)
}

/**
 * Ends the open Nope window as if every player had passed: the action resolves unless the Nopes played so far cancel it. This is
 * what a timer would call when it runs out (the engine has none: a window waits until everybody has answered); with no window
 * open it changes nothing. Pure, like `GAME.apply`: it gives back a new state and the events.
 */
export function resolveWindow(rules: Rules, state: State): Step {
  const ctx = open(rules, state)
  closeWindow(ctx)
  return close(ctx)
}
