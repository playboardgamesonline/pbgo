import { type CardFace, EngineError, type RoundsRule, type StepContext, faceOfId, keyOfId, openStep, playerAt, roundsOutcome, sumRounds } from "@pbgo/engine-kit"
import { CARDS, CATALOGUE } from "./catalogue"
import { TARGET_SCORE } from "./options"
import { sum } from "./scoring"
import { type Cell, OPENING_FLIPS, type SkyjoEvent, type State } from "./types"

/**
 * The machinery every rule is written with: one step of the game is `open` (a private copy of the state, the kit's `openStep` given the types of the game), a few mutations, then `closeStep`
 * of the kit (the new state and what happened, noted with `noteEvent`).
 * Nothing mutates the state that came in, and nothing draws from `Math.random`.
 */

/** What a step works on. `s` is a copy of the state: mutate it freely, the state that came in is never touched. `rng` is the stream of the shuffles. */
export type Ctx = StepContext<State, SkyjoEvent>

/** A step starts here: a copy of the state to mutate, with the stream picked up where the last step left it. */
export const open = (state: State): Ctx => openStep<State, SkyjoEvent>(state)

// --- Cards

/** The value of the card that holds `id`. */
export function valueOf(s: Pick<State, "ids">, id: number): number {
  return CARDS[keyOfId(s.ids, CATALOGUE, id)].value
}

/** The face of the card that holds `id`, as a view shows it. */
export function faceOf(s: Pick<State, "ids">, id: number): CardFace {
  return faceOfId(s.ids, CATALOGUE, id)
}

// --- Players and their grids

export function gridOf(s: State, seat: number): Cell[] {
  const grid = s.grids[seat]
  if (grid === undefined) throw new RangeError(`There is no seat ${seat}`)
  return grid
}

/** How many cards of a seat are face up. */
export function revealedCount(s: State, seat: number): number {
  return gridOf(s, seat).filter((cell) => cell?.up === true).length
}

/** True when every card left in the grid is face up (a grid with no card left counts). */
export function allUp(s: State, seat: number): boolean {
  return gridOf(s, seat).every((cell) => cell === null || cell.up)
}

/** What the cards face up in a seat's grid are worth now. */
export function visibleScore(s: State, seat: number): number {
  return sum(gridOf(s, seat).flatMap((cell) => (cell?.up ? [valueOf(s, cell.card)] : [])))
}

/** What every card left in a seat's grid is worth, face up or not: the round's count once all are turned over. */
export function fullScore(s: State, seat: number): number {
  return sum(gridOf(s, seat).flatMap((cell) => (cell ? [valueOf(s, cell.card)] : [])))
}

// --- Scores and the end

/** The game ends at the end of the first round that leaves a player at the target or above: the lowest total wins, a tie for it shares the win. */
export function rulesOf(): RoundsRule {
  return { target: TARGET_SCORE, wins: "low", tie: "shared" }
}

/** What each seat has banked in the finished rounds. */
export function totalsOf(s: State): number[] {
  return sumRounds(s.rounds, s.seats.length)
}

export function isOver(s: State): boolean {
  return roundsOutcome(totalsOf(s), rulesOf()).over
}

/** How far the game has come, for the HUD: the highest total over the target, from 0 to 100 (a negative total counts for nothing). */
export function progress(s: State): number {
  return Math.max(0, Math.min(100, (100 * Math.max(...totalsOf(s))) / TARGET_SCORE))
}

/** The winners of a finished game, in seat order; nobody while it goes on. */
export function winnersOf(s: State): string[] {
  const outcome = roundsOutcome(totalsOf(s), rulesOf())
  return outcome.over ? outcome.winners.map((seat) => playerAt(s.seats, seat)) : []
}

/** The seats that still have to turn cards over to open the round, in seat order. */
export function openingSeats(s: State): number[] {
  return s.seats.flatMap((_, seat) => (revealedCount(s, seat) < OPENING_FLIPS ? [seat] : []))
}

/**
 * Who the game waits for. Public: while the round opens, every player who still has cards to turn over; then the player of the turn;
 * between two rounds the dealer; nobody once the game is over.
 */
export function waitingFor(s: State): string[] {
  const { stage } = s
  if (stage.kind === "reveal") return openingSeats(s).map((seat) => playerAt(s.seats, seat))
  if (stage.kind === "between") return isOver(s) ? [] : [playerAt(s.seats, s.dealer)]
  return [playerAt(s.seats, stage.seat)]
}

/** Gives the engine's own refusal for a step the current state does not allow. */
export function refuse(what: string): EngineError {
  return new EngineError("INVALID_PHASE", `You cannot ${what} now`)
}
