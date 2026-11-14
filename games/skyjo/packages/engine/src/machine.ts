import { EngineError, type RoundsRule, type SaveableRng, cardOf, restoreRng, roundsOutcome, sumRounds } from "@pbgo/engine-kit"
import { CARDS, CATALOGUE } from "./catalogue"
import { TARGET_SCORE } from "./options"
import { sum } from "./scoring"
import { type Cell, OPENING_FLIPS, type Face, type SkyjoEvent, type SkyjoStep, type State } from "./types"

/**
 * The machinery every rule is written with: one step of the game is `open` (a private copy of the state), a few mutations, then `close`
 * (the new state and what happened). Nothing mutates the state that came in, and nothing draws from `Math.random`.
 */

/** What a step works on. `s` is a copy of the state: mutate it freely, the state that came in is never touched. */
export type Ctx = {
  s: State
  /** Shuffles. */
  rng: SaveableRng
  events: SkyjoStep["events"]
}

/** A step starts here: a copy of the state to mutate, with the stream picked up where the last step left it. */
export function open(state: State): Ctx {
  const s = structuredClone(state)
  return { s, rng: restoreRng(s.rng), events: [] }
}

/** A step ends here: the stream is saved back into the state, which comes out with what happened. */
export function close(ctx: Ctx): SkyjoStep {
  ctx.s.rng = ctx.rng.save()
  return { state: ctx.s, events: ctx.events }
}

/** Notes what happened, for everybody; `to` and `masked` when only some may read it in full. */
export function emit(ctx: Ctx, event: SkyjoEvent, hidden?: { to: string[]; masked: SkyjoEvent }): void {
  ctx.events.push(hidden ? { event, ...hidden } : { event })
}

// --- Cards

/** The face of the card that holds `id`. An id nobody holds is a bug of the engine: no player can name a card. */
export function keyOf(s: Pick<State, "ids">, id: number) {
  const key = CATALOGUE[cardOf(s.ids, id)]
  if (key === undefined) throw new RangeError(`No card holds the id ${id}`)
  return key
}

export function valueOf(s: Pick<State, "ids">, id: number): number {
  return CARDS[keyOf(s, id)].value
}

export function faceOf(s: Pick<State, "ids">, id: number): Face {
  return { id, type: keyOf(s, id) }
}

// --- Players and their grids

/** Seat of a player; -1 when they are not at the table. */
export function seatOf(s: State, playerId: string): number {
  return s.seats.indexOf(playerId)
}

/** Id of the player in `seat`. */
export function playerAt(s: State, seat: number): string {
  const id = s.seats[seat]
  if (id === undefined) throw new RangeError(`There is no seat ${seat}`)
  return id
}

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
  return outcome.over ? outcome.winners.map((seat) => playerAt(s, seat)) : []
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
  if (stage.kind === "reveal") return openingSeats(s).map((seat) => playerAt(s, seat))
  if (stage.kind === "between") return isOver(s) ? [] : [playerAt(s, s.dealer)]
  return [playerAt(s, stage.seat)]
}

/** Gives the engine's own refusal for a step the current state does not allow. */
export function refuse(what: string): EngineError {
  return new EngineError("INVALID_PHASE", `You cannot ${what} now`)
}
