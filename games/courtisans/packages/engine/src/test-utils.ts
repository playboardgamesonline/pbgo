import { type PlayerInfo } from "@pbgo/engine-kit"
import { CATALOGUE, type CardKey, type Family, type Role, cardKey } from "./catalogue"
import { typeOf } from "./machine"
import { setupGame } from "./setup"
import type { Level, PlayZone, State } from "./types"

/**
 * Helpers shared by the tests. They build states and check invariants; the rules are never written again here (the one exception is the scoring in `scoring.test.ts`, written a second time on purpose).
 * Cards are named by their family and their role and found by them in the state, because a test never knows which id a card holds.
 */

// --- Setting up

/**
 * The seed of the `i`th game of a test. The deal uses the LOW 32 bits of a seed and the ids of the cards the HIGH bits (`sideSeed`), so two games only differ in both when their seeds differ in both: this one
 * moves the two halves.
 */
export function seedOf(i: number): number {
  return (i + 1) * 2 ** 32 + (Math.imul(i + 1, 0x9e3779b1) >>> 0)
}

export const PLAYER_IDS = ["ana", "bob", "cleo", "dan", "eva"] as const

/** The first `n` players of the tests, in seat order. */
export function players(n: number): PlayerInfo[] {
  return PLAYER_IDS.slice(0, n).map((id) => ({ id, nickname: id.toUpperCase() }))
}

/** A real game, set up and dealt: the players have to read their missions. */
export function newState(n: number, seed: number = seedOf(0)): State {
  return setupGame({ players: players(n), seed })
}

// --- Reading a state by names

export function seatOf(state: State, playerId: string): number {
  const seat = state.seats.indexOf(playerId)
  if (seat < 0) throw new Error(`${playerId} is not at the table`)
  return seat
}

/** The kind of each card of `ids`, in that order: `noble-hare`, `base-stag`. */
export function kinds(state: State, ids: readonly number[]): CardKey[] {
  return ids.map((id) => cardKey(typeOf(state, id).family, typeOf(state, id).role))
}

export const handOfPlayer = (state: State, playerId: string): number[] => state.hands[seatOf(state, playerId)]!
export const domainOfPlayer = (state: State, playerId: string): number[] => state.domains[seatOf(state, playerId)]!

// --- Rigging a table

/** A card a test names: its family and its role, `null` for a courtier with none. */
export type CardSpec = { family: Family; role: Role | null }

export const card = (family: Family, role: Role | null = null): CardSpec => ({ family, role })

export type Layout = {
  /** A number of players, or their ids. 3 when missing. */
  players?: number | readonly string[]
  /** The cards of each player's hand, by player. Nobody holds a card when missing. */
  hands?: Record<string, readonly CardSpec[]>
  /** The cards of each player's domain, by player. */
  domains?: Record<string, readonly CardSpec[]>
  /** The Queen's table, card by card, each with the side of the mat it lies on. */
  table?: readonly (readonly [CardSpec, Level])[]
  /** The deck, top first. */
  deck?: readonly CardSpec[]
  /** The ids of the missions of each player, the white one then the blue one. */
  missions?: Record<string, readonly string[]>
  /** The players who have read their missions: everybody by default (the banquet is on), `[]` for the opening. */
  read?: readonly string[]
  /** The player of the turn: the first one when missing. */
  active?: string
  /** The zones already played in this turn. */
  zones?: readonly PlayZone[]
  seed?: number
}

/**
 * A table the test rigged: the cards it names are where it says (the ids are the ones of a real game of that seed), nothing else is dealt. The cards that nobody asked for are nowhere, so a layout is a few
 * cards on a table, not a whole box.
 */
export function layout(spec: Layout = {}): State {
  const names = typeof spec.players === "number" ? PLAYER_IDS.slice(0, spec.players) : (spec.players ?? PLAYER_IDS.slice(0, 3))
  const base = setupGame({ players: names.map((id) => ({ id, nickname: id.toUpperCase() })), seed: spec.seed ?? seedOf(0) })
  const taken = new Set<number>()
  const take = ({ family, role }: CardSpec): number => {
    const key = cardKey(family, role)
    const index = CATALOGUE.findIndex((kind, i) => kind === key && !taken.has(i))
    if (index < 0) throw new Error(`The box holds no more "${key}"`)
    taken.add(index)
    return base.ids[index]!
  }
  const seat = (player: string): number => {
    const found = names.indexOf(player)
    if (found < 0) throw new Error(`${player} is not at the table`)
    return found
  }
  const read = spec.read ?? names
  const hands = names.map((id) => (spec.hands?.[id] ?? []).map(take))
  const domains = names.map((id) => (spec.domains?.[id] ?? []).map(take))
  return {
    seats: [...names],
    ids: base.ids,
    rng: base.rng,
    deck: (spec.deck ?? []).map(take),
    setAside: [],
    eliminated: [],
    hands,
    domains,
    table: (spec.table ?? []).map(([kind, level]) => ({ card: take(kind), level })),
    missions: names.map((id) => [...(spec.missions?.[id] ?? [])]),
    read: names.map((id) => read.includes(id)),
    active: spec.active === undefined ? 0 : seat(spec.active),
    zones: [...(spec.zones ?? [])],
  }
}

/** The id of the `n`th card (0 by default) of `kind` that the state holds in `ids`, wherever it is: for a test that has to name a card of a real game. */
export function idOf(state: State, kind: CardKey, n = 0): number {
  const found = [...state.hands.flat(), ...state.domains.flat(), ...state.table.map((placement) => placement.card), ...state.deck].filter((id) => cardKey(typeOf(state, id).family, typeOf(state, id).role) === kind)
  const id = found[n]
  if (id === undefined) throw new Error(`The state holds no ${n + 1}th "${kind}"`)
  return id
}

// --- Invariants

/**
 * What must hold of any state of a real game, as one sentence for each thing that does not (an empty list for a sound state): every card of the box is in exactly one place, a hand holds three cards or fewer, the
 * zones played are different, and nobody who is up has an empty hand.
 */
export function problems(state: State): string[] {
  const found: string[] = []
  const places = [state.deck, state.setAside, state.eliminated, ...state.hands, ...state.domains, state.table.map((placement) => placement.card)]
  const all = places.flat()
  if (all.length !== state.ids.length) found.push(`${all.length} cards are in play, the box has ${state.ids.length}`)
  if (new Set(all).size !== all.length) found.push("a card is in two places")
  if (state.ids.some((id) => !all.includes(id))) found.push("a card of the box is nowhere")
  if (state.hands.some((hand) => hand.length > 3)) found.push("a hand holds more than three cards")
  if (new Set(state.zones).size !== state.zones.length) found.push("a zone was played twice this turn")
  if (state.zones.length >= 3) found.push("a turn went on past three zones")
  const everyoneRead = state.read.every(Boolean)
  const someoneHolds = state.hands.some((hand) => hand.length > 0)
  if (everyoneRead && someoneHolds && state.hands[state.active]!.length === 0) found.push("the player who is up holds no card")
  if (state.missions.some((own) => new Set(own).size !== own.length)) found.push("a player holds the same mission twice")
  return found
}
