import { type PlayerInfo, type Rng, createRng, keyOfId, seatOf } from "@pbgo/engine-kit"
import { step } from "./actions"
import { CARDS, CATALOGUE, type CharacterKey, GUESSES } from "./catalogue"
import { GAME } from "./game"
import { tokensToWin } from "./options"
import { setupGame } from "./setup"
import type { Action, LoveLetterLogEntry, LoveLetterStep, Stage, State } from "./types"
import { playerView } from "./view"

/**
 * Helpers shared by the tests. They build states and actions and check invariants; the rules are never written again here (the one
 * exception is the count of a round in `simulation.test.ts`, written a second time on purpose, to be compared with the engine's).
 * Cards are named by their character and found by it in the state, because a test never knows which id a card holds.
 */

// --- Setting up

/**
 * The seed of the `i`th game of a test. The deal uses the LOW 32 bits of a seed and the ids of the cards the HIGH bits
 * (`sideSeed`), so two games only differ in both when their seeds differ in both: this one moves the two halves.
 */
export function seedOf(i: number): number {
  return (i + 1) * 2 ** 32 + (Math.imul(i + 1, 0x9e3779b1) >>> 0)
}

export const PLAYER_IDS = ["ana", "bob", "cleo", "dan", "eva", "fay"] as const

/** The first `n` players of the tests, in seat order. */
export function players(n: number): PlayerInfo[] {
  return PLAYER_IDS.slice(0, n).map((id) => ({ id, nickname: id.toUpperCase() }))
}

/** A real game, set up and dealt: the first player has drawn and plays. */
export function newState(n: number, seed: number = seedOf(0)): State {
  return setupGame({ players: players(n), seed })
}

// --- Reading a state by characters

/** The seat of a player of the table (`seatOf` of the kit, which a test that names somebody who is not at the table must not get a `-1` from). */
export function seatIn(state: State, playerId: string): number {
  const seat = seatOf(state.seats, playerId)
  if (seat < 0) throw new Error(`${playerId} is not at the table`)
  return seat
}

/** The characters of a list of ids, in the same order. */
export function names(state: State, ids: readonly number[]): CharacterKey[] {
  return ids.map((id) => keyOfId(state.ids, CATALOGUE, id))
}

/** The characters in a player's hand, in the order of the hand. */
export function handNames(state: State, playerId: string): CharacterKey[] {
  return names(state, state.hands[seatIn(state, playerId)]!)
}

/** The characters a player played or discarded this round, oldest first. */
export function areaNames(state: State, playerId: string): CharacterKey[] {
  return names(state, state.areas[seatIn(state, playerId)]!)
}

/** The characters of the deck, top first. */
export function deckNames(state: State): CharacterKey[] {
  return names(state, state.deck)
}

/** The favor tokens of each seat. */
export function tokens(state: State): number[] {
  return state.seats.map((_, seat) => state.won[seat]! + state.spies[seat]!)
}

/** Who the game waits for. */
export function waiting(state: State): string[] {
  return [...GAME.waitingFor!(state)]
}

export function viewOf(state: State, viewer: string | null) {
  return playerView(state, viewer)
}

/** The id of the first card of `key` in a player's hand. */
export function cardIn(state: State, playerId: string, key: CharacterKey): number {
  const hand = state.hands[seatIn(state, playerId)]!
  const id = hand.find((card) => keyOfId(state.ids, CATALOGUE, card) === key)
  if (id === undefined) throw new Error(`${playerId} holds no ${key}`)
  return id
}

// --- Rigging a table

export type Layout = {
  /** A number of players, or their ids. 3 when missing. */
  players?: number | readonly string[]
  /** Whose turn it is, or who deals between two rounds. The first player when missing. */
  turn?: string
  /** What the round is doing: `play` (the turn of `turn`), `keep` (`turn` played a Chancellor and keeps a card) or `between` (the round is over). `play` when missing. */
  stage?: "play" | "keep" | "between"
  /** For `between`: how the round ended. */
  between?: { revealed?: boolean; winners?: readonly string[]; spy?: string | null }
  /** The hands, by the characters they hold. A player who is not named holds a Guard (two on their turn), or nothing when out. */
  hands?: Record<string, readonly CharacterKey[]>
  /** The deck, top first. The rest of the box follows below it (see `rest`). */
  deck?: readonly CharacterKey[]
  /** The card set aside face down. One that nobody asked for when missing. */
  aside?: CharacterKey | null
  /** At two players, the three cards set aside face up. Cards that nobody asked for when missing. */
  faceUp?: readonly CharacterKey[]
  /** The cards played or discarded this round, oldest first. */
  areas?: Record<string, readonly CharacterKey[]>
  /** The players out of the round. */
  out?: readonly string[]
  /** The players a Handmaid protects. */
  shielded?: readonly string[]
  /** The rounds won and the Spy's tokens, by player. */
  won?: Record<string, number>
  spies?: Record<string, number>
  round?: number
  seed?: number
  /** Where the cards of the box that nobody asked for go: the bottom of the deck (default), or nowhere (`"away"`: a deck as short as the test says). */
  rest?: "deck" | "away"
}

/** What a player holds when a test does not say: a Guard, then the cards that do the least. */
const INERT: readonly CharacterKey[] = ["guard", "guard", "guard", "guard", "guard", "guard", "priest", "priest", "baron"]
/** What the card set aside and the cards set aside face up are when a test does not say: the cards at the end of the box. */
const LAST: readonly CharacterKey[] = ["princess", "countess", "king", "chancellor", "chancellor", "prince", "prince", "handmaid"]

/**
 * A table the test rigged: the cards it names are where it says (the ids are the ones of a real game of that seed), the rest of the box goes
 * below the deck. Nothing is dealt: the state is exactly the one described.
 */
export function layout(spec: Layout = {}): State {
  const seated = typeof spec.players === "number" ? PLAYER_IDS.slice(0, spec.players) : (spec.players ?? PLAYER_IDS.slice(0, 3))
  const base = setupGame({ players: seated.map((id) => ({ id, nickname: id.toUpperCase() })), seed: spec.seed ?? seedOf(0) })
  const taken = new Set<number>()
  const take = (key: CharacterKey): number => {
    const index = CATALOGUE.findIndex((card, i) => card === key && !taken.has(i))
    if (index < 0) throw new Error(`The box holds no more "${key}"`)
    taken.add(index)
    return base.ids[index]!
  }
  const takeOneOf = (keys: readonly CharacterKey[]): number => {
    for (const key of keys) if (CATALOGUE.some((card, i) => card === key && !taken.has(i))) return take(key)
    throw new Error("The box has nothing left to fill the table with")
  }
  const seat = (player: string): number => {
    const found = seatOf(seated, player)
    if (found < 0) throw new Error(`${player} is not at the table`)
    return found
  }
  const turn = seat(spec.turn ?? seated[0]!)
  const out = new Set((spec.out ?? []).map(seat))
  const stage: Stage =
    spec.stage === "between"
      ? { kind: "between", revealed: spec.between?.revealed ?? false, winners: (spec.between?.winners ?? []).map(seat), spy: spec.between?.spy == null ? null : seat(spec.between.spy) }
      : { kind: spec.stage ?? "play" }

  // what a test names first, so that what it does not name is filled from what is left
  const named = {
    hands: seated.map((id) => spec.hands?.[id]?.map(take)),
    top: (spec.deck ?? []).map(take),
    areas: seated.map((id) => (spec.areas?.[id] ?? []).map(take)),
    aside: spec.aside === undefined ? undefined : spec.aside === null ? null : take(spec.aside),
    faceUp: spec.faceUp?.map(take),
  }
  const hands = named.hands.map((hand, i) => {
    if (hand !== undefined) return hand
    if (out.has(i)) return []
    if (i !== turn || stage.kind === "between") return [takeOneOf(INERT)]
    return stage.kind === "keep" ? [takeOneOf(INERT), takeOneOf(INERT), takeOneOf(INERT)] : [takeOneOf(INERT), takeOneOf(INERT)]
  })
  const aside = named.aside === undefined ? takeOneOf(LAST) : named.aside
  const faceUp = named.faceUp ?? (seated.length === 2 ? [takeOneOf(LAST), takeOneOf(LAST), takeOneOf(LAST)] : [])
  const rest = base.ids.filter((_, index) => !taken.has(index))
  const by = (record: Record<string, number> | undefined) => seated.map((id) => record?.[id] ?? 0)
  return {
    ...base,
    round: spec.round ?? 1,
    turn,
    stage,
    deck: [...named.top, ...(spec.rest === "away" ? [] : rest)],
    aside,
    faceUp,
    hands,
    areas: named.areas,
    out: seated.map((_, i) => out.has(i)),
    shielded: seated.map((id) => (spec.shielded ?? []).includes(id)),
    won: by(spec.won),
    spies: by(spec.spies),
  }
}

// --- Playing

/** The player plays the first card of `key` of their hand, picking the player `target` and naming the character `guess` when the card asks for them. */
export function playCard(state: State, playerId: string, key: CharacterKey, extra: { target?: string; guess?: CharacterKey } = {}): State {
  return playStep(state, playerId, key, extra).state
}

/** The player keeps the first card of `key` of their hand after a Chancellor and puts the other cards, named by their characters, under the deck in that order. */
export function keepCards(state: State, playerId: string, key: CharacterKey, bottom: readonly CharacterKey[]): State {
  return keepStep(state, playerId, key, bottom).state
}

export function keepStep(state: State, playerId: string, key: CharacterKey, bottom: readonly CharacterKey[]): LoveLetterStep {
  const hand = state.hands[seatIn(state, playerId)]!
  const kept = cardIn(state, playerId, key)
  const rest = hand.filter((id) => id !== kept)
  const used = new Set<number>()
  const ids = bottom.map((name) => {
    const id = rest.find((card) => keyOfId(state.ids, CATALOGUE, card) === name && !used.has(card))
    if (id === undefined) throw new Error(`${playerId} has no ${name} to put back`)
    used.add(id)
    return id
  })
  return step(state, { type: "keep", playerId, card: kept, bottom: ids })
}

/** The same, with what the move said. */
export function playStep(state: State, playerId: string, key: CharacterKey, extra: { target?: string; guess?: CharacterKey } = {}): LoveLetterStep {
  return step(state, { type: "play", playerId, card: cardIn(state, playerId, key), ...extra })
}

export const deal = (state: State, playerId: string): State => step(state, { type: "deal", playerId }).state

/** The kinds of the events of a step, in order. */
export function kinds(result: { events: readonly LoveLetterLogEntry[] }): string[] {
  return result.events.map(({ event }) => event.kind)
}

/** What a test expects an action to be refused with. */
export function refusal(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === "string") return code
    throw error
  }
  throw new Error("The action was accepted")
}

// --- Invariants

/**
 * What must hold for any state of the game, in the middle of a round or not. Gives what does not, one sentence each: `[]` is a sound
 * state. The tests call it after every move. `rigged`: the state was made by `layout` with `rest: "away"`, so the cards that nobody named are nowhere.
 */
export function problems(state: State, options: { rigged?: boolean } = {}): string[] {
  const found: string[] = []
  const n = state.seats.length
  const { ids } = state

  // every card is in exactly one place
  const placed = [...state.deck, ...(state.aside === null ? [] : [state.aside]), ...state.faceUp, ...state.hands.flat(), ...state.areas.flat()]
  if (ids.length !== CATALOGUE.length || new Set(ids).size !== ids.length) found.push("the ids are not 21 different numbers")
  if (new Set(placed).size !== placed.length) found.push("a card is in two places")
  if (placed.some((id) => !ids.includes(id))) found.push("a card that is not one of the 21 is in play")
  if (!options.rigged && placed.length !== ids.length) found.push(`the cards are not each in one place (${placed.length} placed of ${ids.length})`)

  // one entry per seat
  for (const [name, list] of Object.entries({ hands: state.hands, areas: state.areas, out: state.out, shielded: state.shielded, won: state.won, spies: state.spies })) {
    if (list.length !== n) found.push(`${name} has ${list.length} entries for ${n} seats`)
  }
  if (n < 2 || n > 6) found.push(`${n} seats are not a table of 2 to 6`)
  if (state.turn < 0 || state.turn >= n) found.push("the turn is not a seat")
  if (state.round < 1) found.push("the round is not counted")
  if (state.faceUp.length !== (n === 2 ? 3 : 0)) found.push(`${state.faceUp.length} cards are set aside face up at ${n} players`)
  for (const [name, list] of Object.entries({ won: state.won, spies: state.spies })) {
    if (list.some((count) => !Number.isInteger(count) || count < 0)) found.push(`${name} holds something that is not a count`)
  }

  // out of the round: no card in hand and no protection; in the round: one card, two on the turn
  state.seats.forEach((id, seat) => {
    const hand = state.hands[seat]!
    if (state.out[seat]) {
      if (hand.length !== 0) found.push(`${id} is out and holds ${hand.length} cards`)
      if (state.shielded[seat]) found.push(`${id} is out and protected`)
    } else {
      const mover = state.stage.kind !== "between" && state.turn === seat
      // a Chancellor's player holds three cards, or two when the deck held only one
      const sizes = mover ? (state.stage.kind === "keep" ? [2, 3] : [2]) : [1]
      if (!sizes.includes(hand.length)) found.push(`${id} holds ${hand.length} cards, ${sizes.join(" or ")} expected`)
    }
  })
  if (state.stage.kind !== "between" && state.out[state.turn]) found.push("a player who is out has the turn")
  if (state.stage.kind === "between") {
    if (state.stage.winners.length === 0) found.push("a round ended with no winner")
    if (!state.stage.winners.includes(state.turn)) found.push("the first turn of the next round is not a winner's")
    if (state.stage.winners.some((seat) => state.out[seat])) found.push("a winner is out of the round")
    if (state.stage.spy !== null && state.out[state.stage.spy]) found.push("the Spy's token went to a player who is out")
  }
  return found
}

/** Whether the tokens of a state are enough to end the game: written again here from the table of the booklet (p. 7). */
export function enough(state: State): boolean {
  return tokens(state).some((count) => count >= tokensToWin(state.seats.length))
}

// --- Random play

/** The players a card of `playerId` can pick, written again here: the players still in the round who are not protected, the player themselves not counted. */
export function pickable(state: State, playerId: string): string[] {
  return state.seats.filter((id, seat) => id !== playerId && !state.out[seat] && !state.shielded[seat])
}

/** The cards a player may play, written again here: their whole hand, or the Countess alone when the other card is the King or a Prince (p. 9). */
export function playableIds(state: State, playerId: string): number[] {
  const hand = state.hands[seatIn(state, playerId)]!
  const keys = names(state, hand)
  const forced = keys.includes("countess") && (keys.includes("king") || keys.includes("prince"))
  return forced ? hand.filter((id) => keyOfId(state.ids, CATALOGUE, id) === "countess") : [...hand]
}

/** A legal move for the player the game waits for: the choices are the ones a table makes, at random. */
export function randomAction(state: State, rng: Rng): Action {
  const [playerId] = waiting(state)
  if (playerId === undefined) throw new Error("The game waits for nobody")
  if (state.stage.kind === "between") return { type: "deal", playerId }
  if (state.stage.kind === "keep") {
    const hand = state.hands[seatIn(state, playerId)]!
    const card = hand[Math.floor(rng() * hand.length)]!
    const others = hand.filter((id) => id !== card)
    // the order of the cards put back is the player's: a shuffle of them
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[others[i], others[j]] = [others[j]!, others[i]!]
    }
    return { type: "keep", playerId, card, bottom: others }
  }
  const choices = playableIds(state, playerId)
  const card = choices[Math.floor(rng() * choices.length)]!
  const rule = CARDS[keyOfId(state.ids, CATALOGUE, card)].target
  const allowed = rule === "any" ? [playerId, ...pickable(state, playerId)] : rule === "other" ? pickable(state, playerId) : []
  const target = allowed[Math.floor(rng() * allowed.length)]
  const guess = keyOfId(state.ids, CATALOGUE, card) === "guard" && target !== undefined ? GUESSES[Math.floor(rng() * GUESSES.length)] : undefined
  return { type: "play", playerId, card, ...(target === undefined ? {} : { target }), ...(guess === undefined ? {} : { guess }) }
}

/** Plays at random, for the player the game waits for, until `stop` says so. Gives every state met, the first one included. */
export function playRandomly(state: State, seed: number, stop: (state: State) => boolean = () => false, maxMoves = 20_000): State[] {
  const rng = createRng(seed)
  const seen = [state]
  let current = state
  for (let i = 0; i < maxMoves && waiting(current).length > 0 && !stop(current); i++) {
    current = step(current, randomAction(current, rng)).state
    seen.push(current)
  }
  return seen
}
