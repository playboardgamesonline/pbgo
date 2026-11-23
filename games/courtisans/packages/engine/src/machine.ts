import { type StepContext, closeStep, keyOfId, noteEvent, openStep, playerAt } from "@pbgo/engine-kit"
import { CARDS, CATALOGUE, type CardKey, type CardType, weight } from "./catalogue"
import type { CourtisansEvent, CourtisansStep, Courtier, Phase, PlayZone, State, VisibleCard } from "./types"

/**
 * The machinery every rule is written with: one step of the game is `open` (a private copy of the state, the stream picked up where the last step left it), a few mutations, then `close` (the new state and
 * what happened). Nothing mutates the state that came in, and nothing draws from `Math.random`. The kit does the work (`openStep`, `closeStep`, `noteEvent`); a game gives them its types.
 */

/** What a step works on. `s` is a copy of the state: mutate it freely, the state that came in is never touched. `rng` is the stream of the shuffles, which the automatic moves draw from. */
export type Ctx = StepContext<State, CourtisansEvent>

export const open = (state: State): Ctx => openStep<State, CourtisansEvent>(state)

export const close = (ctx: Ctx): CourtisansStep => closeStep(ctx)

/** Notes what happened, for everybody: nothing in Courtisans is private. */
export const emit = (ctx: Ctx, event: CourtisansEvent): void => noteEvent(ctx, event)

// --- Cards

/** The kind of the card that holds `id`. An id nobody holds is a bug of the engine: no player can name a card. */
export function keyOf(s: Pick<State, "ids">, id: number): CardKey {
  return keyOfId(s.ids, CATALOGUE, id)
}

export function typeOf(s: Pick<State, "ids">, id: number): CardType {
  return CARDS[keyOf(s, id)]
}

/** What a card counts for: two for a noble, one for every other card. */
export function weightOf(s: Pick<State, "ids">, id: number): number {
  return weight(typeOf(s, id).role)
}

/** A card the player who holds it knows: its family and its role. */
export function courtierOf(s: Pick<State, "ids">, id: number): Courtier {
  const { family, role } = typeOf(s, id)
  return { id, family, role }
}

/** A card as the others see it: a spy that was played keeps its id (stable when it is revealed) but loses its family, until the game is over. */
export function visibleCard(s: Pick<State, "ids">, id: number, revealed: boolean): VisibleCard {
  const { family, role } = typeOf(s, id)
  return { id, family: role === "spy" && !revealed ? null : family, role }
}

// --- Players and what they hold

export function handOf(s: State, seat: number): number[] {
  const hand = s.hands[seat]
  if (hand === undefined) throw new RangeError(`There is no seat ${seat}`)
  return hand
}

export function domainOf(s: State, seat: number): number[] {
  const domain = s.domains[seat]
  if (domain === undefined) throw new RangeError(`There is no seat ${seat}`)
  return domain
}

// --- The phase, who is waited for, the end

/**
 * Where the game is. The banquet starts for everyone at once, when the last player has read their missions, and it is over when nobody holds a card any more: a turn that leaves nobody with a card in hand
 * ends the game, and a player who is up always has one.
 */
export function phaseOf(s: State): Phase {
  if (s.hands.every((hand) => hand.length === 0)) return "over"
  return s.read.every(Boolean) ? "playing" : "missions"
}

export function isOver(s: State): boolean {
  return phaseOf(s) === "over"
}

/** The player of the turn, once the banquet has started. */
export function activePlayerId(s: State): string | null {
  return phaseOf(s) === "playing" ? playerAt(s.seats, s.active) : null
}

/** The zones where the player of the turn has not played a card yet, in the order of the turn. */
export function availableZones(s: State): PlayZone[] {
  return (["table", "domain", "opponentDomain"] as const).filter((zone) => !s.zones.includes(zone))
}

/**
 * Who the game waits for. Public: while the missions are read, every player who has not read theirs, in seat order; then the player of the turn; nobody once the game is over.
 */
export function waitingFor(s: State): string[] {
  const phase = phaseOf(s)
  if (phase === "over") return []
  if (phase === "missions") return s.seats.filter((_, seat) => !s.read[seat])
  return [playerAt(s.seats, s.active)]
}

/**
 * How far the game has come, for the HUD: the cards that have been played out of the cards that are in play (the ones that were not put aside), from 0 to 100. A card is played once, from a hand,
 * whether it stays where it was put or is eliminated after.
 */
export function progress(s: State): number {
  const inPlay = s.ids.length - s.setAside.length
  const unplayed = s.deck.length + s.hands.reduce((sum, hand) => sum + hand.length, 0)
  return inPlay === 0 ? 100 : (100 * (inPlay - unplayed)) / inPlay
}
