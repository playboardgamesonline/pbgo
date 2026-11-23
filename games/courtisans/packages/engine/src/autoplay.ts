import { EngineError, seatOf } from "@pbgo/engine-kit"
import { playCard, readMissions } from "./actions"
import { type Ctx, availableZones, close, domainOf, handOf, isOver, open, phaseOf, typeOf, waitingFor } from "./machine"
import type { CourtisansStep, State, Target } from "./types"

/**
 * Playing for an absent player: legal, deterministic and complete (the whole turn, not one click). While the missions are read, theirs are read for them. During the banquet, each card of the turn is picked at
 * random from the stream the state carries (`rng`), goes in the first zone that is still free, to a side of the mat or an opponent picked at random, and an assassin eliminates the first card of its zone that is
 * not a guard. The same state always gives the same moves.
 */

/** One card of the turn: a random card of the hand, in the first free zone. */
export function autoMove(ctx: Ctx): void {
  const { s, rng } = ctx
  const random = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!
  const seat = s.active
  const me = s.seats[seat]!
  const card = random(handOf(s, seat))
  const zone = availableZones(s)[0]!
  const opponents = s.seats.filter((id) => id !== me)
  const target: Target =
    zone === "table" ? { zone: "table", level: rng() < 0.5 ? "up" : "down" } : { zone: "domain", playerId: zone === "domain" ? me : random(opponents) }
  let victimId: number | undefined
  if (typeOf(s, card).role === "assassin") {
    const cards = target.zone === "table" ? s.table.map((placement) => placement.card) : domainOf(s, seatOf(s.seats, target.playerId))
    victimId = cards.find((id) => id !== card && typeOf(s, id).role !== "guard")
  }
  playCard(ctx, seat, { cardId: card, target, victimId })
}

/** The player of the turn plays the cards of their turn: up to three, one in each zone, fewer when their hand runs out first. */
export function playTurn(ctx: Ctx): void {
  do autoMove(ctx)
  while (!isOver(ctx.s) && ctx.s.zones.length > 0)
}

/**
 * Plays the current step for `playerId`, who is absent. Legal and complete: the step is over when this returns.
 * `NOT_WAITING` when the game is not waiting for them.
 */
export function autoPlay(ctx: Ctx, playerId: string): void {
  const { s } = ctx
  if (!waitingFor(s).includes(playerId)) throw new EngineError("NOT_WAITING", "The game is not waiting for this player")
  if (phaseOf(s) === "missions") readMissions(ctx, seatOf(s.seats, playerId))
  else playTurn(ctx)
}

/** `GAME.autoPlayStep`: the state once `playerId` has been played for, and what happened. */
export function autoPlayStep(state: State, playerId: string): CourtisansStep {
  const ctx = open(state)
  autoPlay(ctx, playerId)
  return close(ctx)
}

/** `GAME.autoPlayFor`: the state once `playerId` has been played for. */
export function autoPlayFor(state: State, playerId: string): State {
  return autoPlayStep(state, playerId).state
}
