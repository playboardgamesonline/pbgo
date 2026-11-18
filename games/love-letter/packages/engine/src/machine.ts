import { EngineError, type SaveableRng, cardOf, restoreRng } from "@pbgo/engine-kit"
import { CARDS, CATALOGUE, type CharacterKey } from "./catalogue"
import { tokensToWin } from "./options"
import type { Face, LoveLetterEvent, LoveLetterStep, State } from "./types"

/**
 * The machinery every rule is written with: one step of the game is `open` (a private copy of the state), a few mutations, then `close`
 * (the new state and what happened). Nothing mutates the state that came in, and nothing draws from `Math.random`.
 */

/** What a step works on. `s` is a copy of the state: mutate it freely, the state that came in is never touched. */
export type Ctx = {
  s: State
  /** Shuffles and the pick of a first player. */
  rng: SaveableRng
  events: LoveLetterStep["events"]
}

/** A step starts here: a copy of the state to mutate, with the stream picked up where the last step left it. */
export function open(state: State): Ctx {
  const s = structuredClone(state)
  return { s, rng: restoreRng(s.rng), events: [] }
}

/** A step ends here: the stream is saved back into the state, which comes out with what happened. */
export function close(ctx: Ctx): LoveLetterStep {
  ctx.s.rng = ctx.rng.save()
  return { state: ctx.s, events: ctx.events }
}

/** Notes what happened, for everybody; `to` and `masked` when only some may read it in full (the others read `masked`: the fact, never the card). */
export function emit(ctx: Ctx, event: LoveLetterEvent, hidden?: { to: string[]; masked: LoveLetterEvent }): void {
  ctx.events.push(hidden ? { event, ...hidden } : { event })
}

// --- Cards

/** The character of the card that holds `id`. An id nobody holds is a bug of the engine: no player can name a card that is not in their hand. */
export function keyOf(s: Pick<State, "ids">, id: number): CharacterKey {
  const key = CATALOGUE[cardOf(s.ids, id)]
  if (key === undefined) throw new RangeError(`No card holds the id ${id}`)
  return key
}

/** The number printed on the card that holds `id`. */
export function valueOf(s: Pick<State, "ids">, id: number): number {
  return CARDS[keyOf(s, id)].value
}

export function faceOf(s: Pick<State, "ids">, id: number): Face {
  return { id, type: keyOf(s, id) }
}

export function facesOf(s: Pick<State, "ids">, ids: readonly number[]): Face[] {
  return ids.map((id) => faceOf(s, id))
}

/** Takes `id` out of `list`. It must be there: a card is always in exactly one place. */
export function removeFrom(list: number[], id: number): void {
  const index = list.indexOf(id)
  if (index < 0) throw new RangeError(`The card ${id} is not where it should be`)
  list.splice(index, 1)
}

// --- Players and what they hold

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

/** The hand of a seat: the array of the state, to mutate in a step. */
export function handOf(s: State, seat: number): number[] {
  const hand = s.hands[seat]
  if (hand === undefined) throw new RangeError(`There is no seat ${seat}`)
  return hand
}

/** The play area of a seat: the cards it played or discarded this round, oldest first. */
export function areaOf(s: State, seat: number): number[] {
  const area = s.areas[seat]
  if (area === undefined) throw new RangeError(`There is no seat ${seat}`)
  return area
}

export function isOut(s: State, seat: number): boolean {
  return s.out[seat] === true
}

/** The seats still in the round, in seat order. */
export function inRound(s: State): number[] {
  return s.seats.flatMap((_, seat) => (isOut(s, seat) ? [] : [seat]))
}

/** The seat that plays after `from`: the next one clockwise that is still in the round (rulebook, p. 5: a player who is out is skipped). `from` itself comes last. */
export function nextInRound(s: State, from: number): number {
  const n = s.seats.length
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n
    if (!isOut(s, seat)) return seat
  }
  throw new RangeError("Nobody is left in the round")
}

/** The only card of a seat's hand: what a player in the round holds between turns, or once they played the card of their turn. */
export function soleCard(s: State, seat: number): number {
  const hand = handOf(s, seat)
  const [card] = hand
  if (hand.length !== 1 || card === undefined) throw new RangeError(`Seat ${seat} holds ${hand.length} cards, one was expected`)
  return card
}

/** The other players a card of `seat` can pick: still in the round and not protected by a Handmaid, in seat order (rulebook, pp. 5, 11). The player themselves is never in the list. */
export function targetsOf(s: State, seat: number): number[] {
  return inRound(s).filter((other) => other !== seat && s.shielded[other] !== true)
}

/** The ids of the cards the player in `seat` may play now: their whole hand on their turn, nothing otherwise. */
export function playableOf(s: State, seat: number): number[] {
  return s.stage.kind === "play" && s.turn === seat ? [...handOf(s, seat)] : []
}

// --- Tokens and the end

/** The favor tokens of each seat: the rounds it won and the Spy's tokens (rulebook, pp. 6, 13). Never stored. */
export function tokensOf(s: State): number[] {
  return s.seats.map((_, seat) => (s.won[seat] ?? 0) + (s.spies[seat] ?? 0))
}

/** The game ends as soon as a player holds the tokens that the number of players asks for (rulebook, p. 7). */
export function isOver(s: State): boolean {
  const needed = tokensToWin(s.seats.length)
  return tokensOf(s).some((tokens) => tokens >= needed)
}

/** The winners of a finished game, in seat order: every player who holds at least the number of tokens, whatever their count above it (the reading validated for p. 7). Nobody while it goes on. */
export function winnersOf(s: State): string[] {
  if (!isOver(s)) return []
  const needed = tokensToWin(s.seats.length)
  const tokens = tokensOf(s)
  return s.seats.filter((_, seat) => (tokens[seat] ?? 0) >= needed)
}

/** How far the game has come, for the HUD: the best player's tokens over the tokens that win, from 0 to 100. */
export function progress(s: State): number {
  return Math.min(100, (100 * Math.max(...tokensOf(s))) / tokensToWin(s.seats.length))
}

/**
 * Who the game waits for. Public: the player of the turn; between two rounds the player who takes the first turn and deals; nobody once the
 * game is over. Never a player who is out.
 */
export function waitingFor(s: State): string[] {
  if (isOver(s)) return []
  return [playerAt(s, s.turn)]
}

/** Gives the engine's own refusal for a step the current state does not allow. */
export function refuse(what: string): EngineError {
  return new EngineError("INVALID_PHASE", `You cannot ${what} now`)
}
