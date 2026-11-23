import { EngineError, type RoundsRule, type StepContext, closeStep, keyOfId, nextSeat, openStep, playerAt, roundsOutcome, sumRounds } from "@pbgo/engine-kit"
import { type ActionEffect, CARDS, CATALOGUE, type CardType } from "./catalogue"
import { DEFAULT_TARGET } from "./options"
import { lineScore, numberValues } from "./scoring"
import type { Flip7Event, FrameOf, State } from "./types"

/**
 * The machinery every rule is written with: one step of the game is `open` (a private copy of the state), a few mutations, then `close`
 * (the new state and what happened). Nothing mutates the state that came in, and nothing draws from `Math.random`. The step, the seats
 * and the faces are the kit's (`openStep`, `playerAt`, `faceOfId`…): this file adds only what is Flip 7's.
 */

/** What a step works on. `s` is a copy of the state: mutate it freely, the state that came in is never touched. `rng` shuffles; `events` is what happened so far (`noteEvent`). */
export type Ctx = StepContext<State, Flip7Event>

/** A step starts here: a copy of the state to mutate, with the stream picked up where the last step left it. */
export const open = (state: State): Ctx => openStep<State, Flip7Event>(state)

/** A step ends here: the stream is saved back into the state, which comes out with what happened. */
export const close = (ctx: Ctx) => closeStep(ctx)

// --- Cards

/** What a card is, for the rules. An id nobody holds is a bug of the engine: no player can name a card. */
export function typeOf(s: Pick<State, "ids">, id: number): CardType {
  return CARDS[keyOfId(s.ids, CATALOGUE, id)]
}

/** What an action card does. */
export function effectOf(s: Pick<State, "ids">, id: number): ActionEffect {
  const card = typeOf(s, id)
  if (card.kind !== "action") throw new RangeError(`The card ${id} is not an action card`)
  return card.effect
}

// --- Players and their lines

/** The cards in front of a seat. */
export function lineOf(s: State, seat: number): number[] {
  const line = s.lines[seat]
  if (line === undefined) throw new RangeError(`There is no seat ${seat}`)
  return line
}

export function lineTypes(s: State, seat: number): CardType[] {
  return lineOf(s, seat).map((id) => typeOf(s, id))
}

/** The values of the number cards in front of a seat. */
export function numbersOf(s: State, seat: number): number[] {
  return numberValues(lineTypes(s, seat))
}

/** The Second Chance in front of a seat: a player holds one at a time. */
export function secondChanceIn(s: State, seat: number): number | undefined {
  return lineOf(s, seat).find((id) => {
    const card = typeOf(s, id)
    return card.kind === "action" && card.effect === "second-chance"
  })
}

export function isActive(s: State, seat: number): boolean {
  return s.status[seat] === "active"
}

/**
 * The next active seat clockwise after `from`, `from` itself last: after the dealer, that is the player on their left first and the
 * dealer last. `null` when nobody is active.
 */
export const nextActive = (s: State, from: number): number | null => nextSeat(s.seats.length, from, (seat) => !isActive(s, seat))

/**
 * Who may get the action card of a `target` frame, in seat order. A Freeze or a Flip Three goes to any active player, the holder
 * included; a Second Chance to any other active player who does not hold one already.
 */
export function targetsOf(s: State, frame: FrameOf<"target">): number[] {
  const secondChance = effectOf(s, frame.card) === "second-chance"
  return s.seats.flatMap((_, seat) => {
    if (!isActive(s, seat)) return []
    if (secondChance && (seat === frame.seat || secondChanceIn(s, seat) !== undefined)) return []
    return [seat]
  })
}

// --- Scores

/** What a seat scores when the round ends now: nothing once busted, else the value of its line. */
export function roundScore(s: State, seat: number): number {
  return s.status[seat] === "busted" ? 0 : lineScore(lineTypes(s, seat))
}

/** The score that wins the game. */
export function targetOf(s: State): number {
  const value = s.options.targetScore
  return typeof value === "number" ? value : DEFAULT_TARGET
}

/** The game ends at the end of the first round that leaves a player at the target, or above: the best total wins, and a tie for it plays on, round after round, until one player is alone at the top. */
export function rulesOf(s: State): RoundsRule {
  return { target: targetOf(s), wins: "high", tie: "playOn" }
}

/** What each seat has banked in the finished rounds. */
export function totalsOf(s: State): number[] {
  return sumRounds(s.rounds, s.seats.length)
}

export function isOver(s: State): boolean {
  return roundsOutcome(totalsOf(s), rulesOf(s)).over
}

/** How far the game has come, for the HUD: the best total over the target score, from 0 to 100 (the totals go past the target in a tie that plays on). The kit keeps it under 100 until the game is over (`progressOf`), so that tie stays at 99. */
export function progress(s: State): number {
  return Math.min(100, (100 * Math.max(...totalsOf(s))) / targetOf(s))
}

/** The winners of a finished game, in seat order; nobody while it goes on. */
export function winnersOf(s: State): string[] {
  const outcome = roundsOutcome(totalsOf(s), rulesOf(s))
  return outcome.over ? outcome.winners.map((seat) => playerAt(s.seats, seat)) : []
}

/**
 * Who the game waits for: the player of the turn, the holder of an action card, or between two rounds the next dealer. Always one
 * player, nobody once the game is over. Public.
 */
export function waitingFor(s: State): string[] {
  const top = s.stack.at(-1)
  if (top === undefined) return isOver(s) ? [] : [playerAt(s.seats, s.dealer)]
  if (top.kind === "turn" || top.kind === "target") return [playerAt(s.seats, top.seat)]
  return []
}

/** Gives the engine's own refusal for a step the current state does not allow. */
export function refuse(what: string): EngineError {
  return new EngineError("INVALID_ACTION", `You cannot ${what} now`)
}
