import { type PlayerInfo, type Rng, createRng, isEngineError, playFor, shuffle, waitingPlayers } from "@pbgo/engine-kit"
import { expect } from "vitest"
import { step } from "./actions"
import { autoPlay } from "./autoplay"
import { buildCatalogue } from "./catalogue"
import { GAME } from "./game"
import { close, open } from "./machine"
import { ORIGINAL_RULES } from "./rules"
import { setupGame } from "./setup"
import { type Action, type ActionOf, EK_ERROR_CODES, type EkErrorCode, type EkEvent, type EkLogEntry, type PlayerView, type State, type Step } from "./types"
import { playerView } from "./view"

/**
 * Helpers shared by the tests. They build states and actions and check invariants; the rules are never written again here.
 * Cards are named by their title (a key of `CARDS`) and found by it in the state, because the id a card holds changes whenever
 * it goes back into hiding.
 */

// --- Setting up

/**
 * The seed of the `i`th game of a test. The deal uses the LOW 32 bits of a seed and the ids of the cards the HIGH bits
 * (`sideSeed`), so two games only differ in both when their seeds differ in both: this one moves the two halves.
 */
export function seedOf(i: number): number {
  return (i + 1) * 2 ** 32 + (Math.imul(i + 1, 0x9e3779b1) >>> 0)
}

export const PLAYER_IDS = ["ana", "bob", "cleo", "dan", "eva"] as const

/** The first `n` players of the tests, in seat order. */
export function players(n: number): PlayerInfo[] {
  return PLAYER_IDS.slice(0, n).map((id) => ({ id, nickname: id.toUpperCase() }))
}

/** A real game of the Original Edition, set up. */
export function newState(n: number, seed: number = seedOf(0), options?: unknown): State {
  return setupGame(ORIGINAL_RULES, { players: players(n), options, seed })
}

export function viewOf(state: State, viewer: string | null): PlayerView {
  return playerView(ORIGINAL_RULES, state, viewer)
}

// --- Reading a state by titles

export function typesOf(state: State): string[] {
  return buildCatalogue(ORIGINAL_RULES, state.options)
}

/** What the card that holds `id` is. */
export function titleOf(state: State, id: number): string {
  const type = typesOf(state)[state.ids.indexOf(id)]
  if (type === undefined) throw new Error(`No card holds the id ${id}`)
  return type
}

export function titles(state: State, ids: readonly number[]): string[] {
  const types = typesOf(state)
  return ids.map((id) => {
    const type = types[state.ids.indexOf(id)]
    if (type === undefined) throw new Error(`No card holds the id ${id}`)
    return type
  })
}

export function seatOf(state: State, playerId: string): number {
  const seat = state.seats.indexOf(playerId)
  if (seat < 0) throw new Error(`${playerId} is not at the table`)
  return seat
}

/** The ids in the hand of a player. */
export function handIds(state: State, playerId: string): number[] {
  return state.hands[seatOf(state, playerId)]!
}

/** The titles in the hand of a player, sorted: a stable thing to compare. */
export function handTitles(state: State, playerId: string): string[] {
  return titles(state, handIds(state, playerId)).sort()
}

/** The draw pile by title, top first. */
export function deckTitles(state: State): string[] {
  return titles(state, state.deck)
}

/** The discard by title, top first. */
export function discardTitles(state: State): string[] {
  return titles(state, state.discard)
}

/** The ids of the cards of this title in a hand, in hand order. */
export function idsOf(state: State, playerId: string, title: string): number[] {
  return handIds(state, playerId).filter((id) => titleOf(state, id) === title)
}

/** The `nth` card of this title in a hand. */
export function idOf(state: State, playerId: string, title: string, nth = 0): number {
  const id = idsOf(state, playerId, title)[nth]
  if (id === undefined) throw new Error(`${playerId} does not hold a ${title} (#${nth})`)
  return id
}

/** The `nth` card of this title in the discard, from the top. */
export function discardIdOf(state: State, title: string, nth = 0): number {
  const id = state.discard.filter((card) => titleOf(state, card) === title)[nth]
  if (id === undefined) throw new Error(`The discard holds no ${title} (#${nth})`)
  return id
}

export function living(state: State): string[] {
  return state.seats.filter((id) => !state.out.includes(id))
}

/** The Exploding Kittens that are in play: in the draw pile, or in the air while their owner chooses where to put them back. */
export function kittensInPlay(state: State): number {
  const types = typesOf(state)
  const inDeck = state.deck.filter((id) => types[state.ids.indexOf(id)] === "exploding-kitten").length
  return inDeck + (state.phase.kind === "defuse" ? 1 : 0)
}

// --- Rigging a table

export type Layout = {
  /** The titles each player holds. A player who is not named holds nothing. */
  hands?: Record<string, readonly string[]>
  /** The draw pile, top first. Three cats when missing, so that a draw always has something to take. */
  deck?: readonly string[]
  /** The discard, top first. */
  discard?: readonly string[]
  /** Who plays: the first seat when missing. */
  turn?: string
  owed?: number
  attacked?: boolean
  /** The players who are out, in the order they left. They hold nothing. */
  out?: readonly string[]
  options?: Record<string, unknown>
  seed?: number
}

/** What the draw pile holds when a test does not say: nothing that matters. */
const FILLER = ["rainbow-ralphing-cat", "beard-cat", "hairy-potato-cat"]

/**
 * A draw pile that lasts as long as a test needs: eight cats. The tests that use it keep these two kinds out of every hand (the box
 * holds four of each), so a layout can put any other title in a hand and in the discard.
 */
export const CATS: readonly string[] = [
  "cattermelon",
  "cattermelon",
  "cattermelon",
  "cattermelon",
  "hairy-potato-cat",
  "hairy-potato-cat",
  "hairy-potato-cat",
  "hairy-potato-cat",
]

/**
 * A table of `n` players where the cards are where the test puts them, in phase `turn`. It starts from a real setup (the streams
 * are the game's own, so what follows is as deterministic as in a real game) and gives every card of the layout a real card, with
 * its own id. Cards that the layout does not name are out of the game, as if they were taken out when the table was set up.
 *
 * Only rigs a turn: windows, Kitten to put back, Favor and discard picks all come from real actions played on it.
 */
export function rig(n: number, layout: Layout = {}): State {
  const base = newState(n, layout.seed ?? seedOf(0), layout.options)
  const types = typesOf(base)
  const free = new Map<string, number[]>()
  types.forEach((type, index) => free.set(type, [...(free.get(type) ?? []), base.ids[index]!]))
  const take = (title: string): number => {
    const id = free.get(title)?.shift()
    if (id === undefined) throw new Error(`The rig runs out of ${title}`)
    return id
  }
  const out = [...(layout.out ?? [])]
  const hands = base.seats.map((id) => {
    const wanted = layout.hands?.[id] ?? []
    if (out.includes(id) && wanted.length > 0) throw new Error(`${id} is out: they hold no card`)
    return wanted.map(take)
  })
  const discard = (layout.discard ?? []).map(take)
  const deck = (layout.deck ?? FILLER).map(take)
  const turn = layout.turn === undefined ? 0 : seatOf(base, layout.turn)
  if (out.includes(base.seats[turn]!)) throw new Error("The current player is out")
  return {
    ...base,
    deck,
    discard,
    hands,
    out,
    turn,
    owed: layout.owed ?? 1,
    attacked: layout.attacked ?? false,
    known: {},
    phase: { kind: "turn" },
  }
}

// --- Actions, by title

/** An action, or one that needs the state to find its cards and the chain (`run` gives it the state it plays on). */
export type Move = Action | ((state: State) => Action)

/** The number of Nopes of the open window, which `nope` and `pass` must send back; 0 when none is open. */
export function chainOf(state: State): number {
  return state.phase.kind === "reaction" ? state.phase.nopes.length : 0
}

export function play(playerId: string, title: string, target?: string): Move {
  return (state) => ({ type: "play", playerId, card: idOf(state, playerId, title), ...(target === undefined ? {} : { target }) })
}

/** The ids of `wanted`, one card of the hand for each (two titles alike are two different cards). */
function idsForTitles(state: State, playerId: string, wanted: readonly string[]): number[] {
  const taken = new Set<number>()
  return wanted.map((title) => {
    const id = idsOf(state, playerId, title).find((candidate) => !taken.has(candidate))
    if (id === undefined) throw new Error(`${playerId} does not hold enough ${title}`)
    taken.add(id)
    return id
  })
}

export function combo(playerId: string, wanted: readonly string[], target?: string, named?: string): Move {
  return (state) => ({
    type: "combo",
    playerId,
    cards: idsForTitles(state, playerId, wanted),
    ...(target === undefined ? {} : { target }),
    ...(named === undefined ? {} : { named }),
  })
}

export function nope(playerId: string, nth = 0): Move {
  return (state) => ({ type: "nope", playerId, card: idOf(state, playerId, "nope", nth), chain: chainOf(state) })
}

export function pass(playerId: string): Move {
  return (state) => ({ type: "pass", playerId, chain: chainOf(state) })
}

export function draw(playerId: string): ActionOf<"draw"> {
  return { type: "draw", playerId }
}

export function defuse(playerId: string, position: number): ActionOf<"defuse"> {
  return { type: "defuse", playerId, position }
}

/** The answer to a Favor: this card of the hand goes to the player who asked. */
export function give(playerId: string, title: string): Move {
  return (state) => ({ type: "give", playerId, card: idOf(state, playerId, title) })
}

/** The card taken from the discard after five different cards: the `nth` one of this title, from the top. */
export function pick(playerId: string, title: string, nth = 0): Move {
  return (state) => ({ type: "pick", playerId, card: discardIdOf(state, title, nth) })
}

// --- Playing

/** What a sequence of moves did: the last state and every event, in order. */
export function trace(state: State, ...moves: Move[]): Step {
  let current = state
  const events: EkLogEntry[] = []
  for (const move of moves) {
    const result = step(ORIGINAL_RULES, current, typeof move === "function" ? move(current) : move)
    current = result.state
    events.push(...result.events)
  }
  return { state: current, events }
}

export function run(state: State, ...moves: Move[]): State {
  return trace(state, ...moves).state
}

/** Everybody the open window waits for passes, one after the other, until it closes: the last state and what happened on the way. */
export function tracePassAll(state: State): Step {
  let current = state
  const events: EkLogEntry[] = []
  while (current.phase.kind === "reaction") {
    const { passed } = current.phase
    const next = current.seats.find((id) => passed[id] === null)
    if (next === undefined) throw new Error("The window is open and nobody is left to pass")
    const result = trace(current, pass(next))
    current = result.state
    events.push(...result.events)
  }
  return { state: current, events }
}

/** The same, for the state only. */
export function passAll(state: State): State {
  return tracePassAll(state).state
}

/** `playerId` plays the card and nobody answers: it resolves. */
export function playThrough(state: State, playerId: string, title: string, target?: string): State {
  return passAll(run(state, play(playerId, title, target)))
}

/** The same for a combo. */
export function comboThrough(state: State, playerId: string, wanted: readonly string[], target?: string, named?: string): State {
  return passAll(run(state, combo(playerId, wanted, target, named)))
}

/** The event kinds of a trace, in order. */
export function kinds(events: readonly EkLogEntry[]): string[] {
  return events.map(({ event }) => event.kind)
}

/** The first log entry of this kind, with who may see it. A trace that holds none fails the test. */
export function entryOf<K extends EkEvent["kind"]>(events: readonly EkLogEntry[], kind: K): EkLogEntry & { event: Extract<EkEvent, { kind: K }> } {
  const entry = events.find((candidate) => candidate.event.kind === kind)
  if (entry === undefined) throw new Error(`The trace holds no ${kind} event (it holds: ${kinds(events).join(", ")})`)
  return entry as EkLogEntry & { event: Extract<EkEvent, { kind: K }> }
}

/** The first event of this kind. */
export function eventOf<K extends EkEvent["kind"]>(events: readonly EkLogEntry[], kind: K): Extract<EkEvent, { kind: K }> {
  return entryOf(events, kind).event
}

// --- Refusals

/** The code of the `EngineError` that `fn` throws. Anything else (another error, or no error at all) fails the test. */
export function codeOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    if (isEngineError(error)) return error.code
    throw error
  }
  throw new Error("Expected the engine to refuse, but it accepted")
}

/**
 * `move` is refused with `code`, and the state it was tried on is left as it was. `move` is whatever a client may send, well formed
 * or not (a `Move` is built from the state it is played on, and so is a function of the state: the first overload types it).
 */
export function expectRefused(state: State, move: (on: State) => unknown, code: EkErrorCode): void
export function expectRefused(state: State, move: unknown, code: EkErrorCode): void
export function expectRefused(state: State, move: unknown, code: EkErrorCode): void {
  const before = structuredClone(state)
  const action = typeof move === "function" ? (move as (on: State) => unknown)(state) : move
  expect(codeOf(() => step(ORIGINAL_RULES, state, action as Action))).toBe(code)
  expect(state).toStrictEqual(before)
}

// --- Invariants

function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true
  if (typeof value !== "object" || value === null) return false
  return Object.values(value).some(hasUndefined)
}

/**
 * What is wrong with a state, in words (an empty list when it holds together). Holds for every state a game can reach, whether it
 * was set up or rigged; `kittensInPlay` is the one rule of a game played from the setup only.
 */
export function problems(state: State): string[] {
  const found: string[] = []
  const types = typesOf(state)
  const known = new Set(state.ids)
  const kindOfId = (id: number): string => ORIGINAL_RULES.cards[types[state.ids.indexOf(id)] ?? ""]?.kind ?? "?"

  if (known.size !== state.ids.length) found.push("two cards hold the same id")
  const placed = [...state.hands.flat(), ...state.deck, ...state.discard, ...(state.phase.kind === "defuse" ? [state.phase.kitten] : [])]
  if (new Set(placed).size !== placed.length) found.push("a card is in two places")
  if (placed.some((id) => !known.has(id))) found.push("a placed card is not one of the cards of the game")
  if (state.hands.length !== state.seats.length || state.stats.length !== state.seats.length) found.push("a seat has no hand or no stats")
  if (state.hands.some((hand) => hand.some((id) => kindOfId(id) === "kitten"))) found.push("an Exploding Kitten is in a hand")
  if (new Set(state.out).size !== state.out.length || state.out.some((id) => !state.seats.includes(id))) found.push("the list of the players out is wrong")
  for (const id of state.out) if (handIds(state, id).length > 0) found.push(`${id} is out and holds cards`)
  for (const [id, n] of Object.entries(state.known)) {
    if (!Number.isInteger(n) || n < 1 || n > state.deck.length) found.push(`${id} knows ${n} cards of a pile of ${state.deck.length}`)
    if (state.out.includes(id)) found.push(`${id} is out and still knows the top of the pile`)
  }
  if (!Number.isInteger(state.owed) || state.owed < 1) found.push(`${state.owed} turns owed`)
  if (hasUndefined(state)) found.push("the state holds an undefined value")

  const alive = living(state)
  const { phase } = state
  if (phase.kind === "over") {
    if (alive.length !== 1) found.push("a finished game has one player left")
  } else {
    if (alive.length < 2) found.push("a game on needs two players")
    if (state.out.includes(state.seats[state.turn]!)) found.push("the current player is out")
  }
  if (phase.kind === "reaction") {
    const last = phase.nopes.at(-1)?.by ?? phase.pending.by
    const expected = alive.filter((id) => id !== last)
    if (Object.keys(phase.passed).sort().join() !== [...expected].sort().join()) found.push("the window waits for the wrong players")
    const onTable = phase.pending.kind === "card" ? [phase.pending.card] : phase.pending.cards
    if ([...onTable, ...phase.nopes.map(({ card }) => card)].some((id) => !state.discard.includes(id))) found.push("a card of the window is not on the discard")
  }
  if (phase.kind === "give" && (phase.from === phase.to || state.out.includes(phase.from) || state.out.includes(phase.to))) {
    found.push("a Favor between the wrong players")
  }
  if (phase.kind === "pick" && phase.played.some((id) => !state.discard.includes(id))) found.push("the cards just played are not on the discard")
  return found
}

export function expectIntegrity(state: State): void {
  expect(problems(state)).toEqual([])
}

/** The state goes through JSON and comes back the same (it is stored as `jsonb`). */
export function expectSerializable(state: State): void {
  expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state)
}

// --- Other

/** A deep copy with every object's keys in the opposite order: `jsonb` does not keep the order of the keys. */
export function reorderKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reorderKeys) as T
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorderKeys(item)])) as T
  }
  return value
}

/** Freezes a value and everything in it: a function that writes into its input then throws. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const item of Object.values(value)) deepFreeze(item)
  }
  return value
}

// --- A random table

/** What a client may send that is not an action, or not a whole one. */
const NOT_ACTIONS: readonly unknown[] = [
  null,
  undefined,
  42,
  "draw",
  [],
  {},
  { type: "draw" },
  { playerId: "ana" },
  { type: 7, playerId: "ana" },
  { type: "dance", playerId: "ana" },
  { type: "play", playerId: "ana", card: "x" },
  { type: "play", playerId: "ana", card: 1.5 },
  { type: "combo", playerId: "ana", cards: "x" },
  { type: "defuse", playerId: "ana", position: "top" },
  { type: "nope", playerId: "ana", card: 0 },
]

/** One of the items, drawn with `rng`. */
export function oneOf<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]!
}

/** The hand of a player at the table; nothing for somebody who is not. */
function handOf(state: State, playerId: string): number[] {
  const seat = state.seats.indexOf(playerId)
  return seat < 0 ? [] : state.hands[seat]!
}

/** Who sends the next action: mostly a player the game waits for, now and then anybody, now and then a stranger. */
function whoActs(state: State, rng: Rng): string {
  if (rng() < 0.03) return "zoe"
  if (rng() < 0.06) return oneOf(state.seats, rng)
  const { phase } = state
  if (phase.kind === "reaction" && rng() < 0.9) {
    const open = Object.keys(phase.passed).filter((id) => phase.passed[id] === null)
    if (open.length > 0) return oneOf(open, rng)
  }
  const waiting = waitingPlayers(GAME, state)
  return oneOf(waiting.length > 0 ? waiting : state.seats, rng)
}

function reactionAction(state: State, by: string, rng: Rng): unknown {
  const chain = chainOf(state) + (rng() < 0.92 ? 0 : oneOf([-1, 1, 2], rng))
  const nope = handOf(state, by).find((id) => titleOf(state, id) === "nope")
  if (nope !== undefined && rng() < 0.4) return { type: "nope", playerId: by, card: nope, chain }
  if (rng() < 0.03) return { type: "nope", playerId: by, card: oneOf(state.ids, rng), chain }
  return { type: "pass", playerId: by, chain }
}

function playAction(state: State, by: string, aim: () => string, rng: Rng): unknown {
  const hand = handOf(state, by)
  const actions = hand.filter((id) => ORIGINAL_RULES.cards[titleOf(state, id)]?.kind === "action")
  const card = actions.length > 0 && rng() < 0.9 ? oneOf(actions, rng) : oneOf(hand.length > 0 ? hand : state.ids, rng)
  return { type: "play", playerId: by, card, ...(titleOf(state, card) === "favor" || rng() < 0.05 ? { target: aim() } : {}) }
}

function comboAction(state: State, by: string, aim: () => string, rng: Rng): unknown {
  const hand = handOf(state, by)
  const groups = new Map<string, number[]>()
  for (const id of hand) groups.set(titleOf(state, id), [...(groups.get(titleOf(state, id)) ?? []), id])
  const same = [...groups.values()]
  const pairs = same.filter((group) => group.length >= 2)
  const triples = same.filter((group) => group.length >= 3)
  const mode = rng()
  let cards: number[]
  if (mode < 0.35 && pairs.length > 0) cards = oneOf(pairs, rng).slice(0, 2)
  else if (mode < 0.5 && triples.length > 0) cards = oneOf(triples, rng).slice(0, 3)
  else if (mode < 0.8 && same.length >= 5) cards = shuffle(same.map((group) => group[0]!), rng).slice(0, 5)
  else cards = shuffle(hand, rng).slice(0, 2 + Math.floor(rng() * 4))
  if (cards.length === 5 && rng() < 0.9) return { type: "combo", playerId: by, cards }
  const target = aim()
  if (cards.length !== 3) return { type: "combo", playerId: by, cards, target }
  const held = handOf(state, target)
  const named =
    rng() < 0.03 ? "unicorn" : held.length > 0 && rng() < 0.5 ? titleOf(state, oneOf(held, rng)) : oneOf(Object.keys(ORIGINAL_RULES.cards), rng)
  return { type: "combo", playerId: by, cards, target, named }
}

function turnAction(state: State, by: string, rng: Rng): unknown {
  const others = living(state).filter((id) => id !== by)
  // Now and then the target is the player themself, or somebody who is out
  const aim = (): string => (rng() < 0.92 && others.length > 0 ? oneOf(others, rng) : oneOf(state.seats, rng))
  const roll = rng()
  if (roll < 0.4 || (handOf(state, by).length === 0 && roll < 0.9)) return { type: "draw", playerId: by }
  return roll < 0.7 ? playAction(state, by, aim, rng) : comboAction(state, by, aim, rng)
}

/**
 * An action as a client might send it while `state` is on: mostly the move the phase asks for and mostly a legal one, now and then
 * a move the rules refuse (a stranger, a card that is not in the hand, a stale chain, the move of another phase), and now and then
 * something that is no action at all. Seeded: the same state and rng draw the same action.
 */
export function randomAction(state: State, rng: Rng): unknown {
  if (rng() < 0.03) return oneOf(NOT_ACTIONS, rng)
  const by = whoActs(state, rng)
  const { phase } = state
  const kind = rng() < 0.1 ? oneOf(["turn", "reaction", "defuse", "give", "pick"] as const, rng) : phase.kind
  switch (kind) {
    case "reaction":
      return reactionAction(state, by, rng)
    case "defuse": {
      const last = state.deck.length
      return { type: "defuse", playerId: by, position: rng() < 0.08 ? oneOf([-1, last + 1, 1.5], rng) : Math.floor(rng() * (last + 1)) }
    }
    case "give": {
      const hand = handOf(state, by)
      return { type: "give", playerId: by, card: oneOf(hand.length > 0 && rng() < 0.95 ? hand : state.ids, rng) }
    }
    case "pick": {
      // What the rule allows is a card that was on the discard before the combo, and not an Exploding Kitten: this only guesses it
      const played = phase.kind === "pick" ? phase.played : []
      const older = state.discard.filter((id) => !played.includes(id) && titleOf(state, id) !== "exploding-kitten")
      return { type: "pick", playerId: by, card: oneOf(older.length > 0 && rng() < 0.85 ? older : state.ids, rng) }
    }
    default:
      return turnAction(state, by, rng)
  }
}

/** One move of a random game that was accepted. */
export type Played = {
  /** The state the move was played on. */
  before: State
  /** What was sent; `null` when the engine played for a player who is waited for (`playFor`), where nothing was sent. */
  action: Action | null
  state: State
  /** What happened, as the engine's own step reports it (and the platform does not keep). After `playFor`, the events of the automatic move. */
  events: EkLogEntry[]
}

/**
 * Plays a table with random players until the game is over, and hands every move that the engine accepted to `visit`. Every refusal
 * is checked on the way: an `EngineError` with a code of `EK_ERROR_CODES`, the state left as it was. A state that refuses sixteen
 * draws in a row is played on by the engine itself, and so is the share `absent` of the moves (0 to 1): the player the game waits
 * for is away, and the takeover plays for them. A game that is not over after `maxMoves` fails.
 */
export function playRandomly(
  start: State,
  seed: number,
  visit: (played: Played) => void = () => {},
  maxMoves = 3000,
  absent = 0,
): { state: State; moves: number; refused: Record<string, number> } {
  const rng = createRng(seed)
  const refused: Record<string, number> = {}
  let state = start
  let moves = 0
  while (state.phase.kind !== "over") {
    if (moves >= maxMoves) throw new Error(`The game is not over after ${maxMoves} moves`)
    let played: Played | null = null
    const away = absent > 0 && rng() < absent
    for (let tries = 0; tries < 16 && played === null && !away; tries++) {
      const action = randomAction(state, rng)
      const before = structuredClone(state)
      try {
        const result = step(ORIGINAL_RULES, state, action as Action)
        played = { before: state, action: action as Action, state: result.state, events: result.events }
      } catch (error) {
        if (!isEngineError(error)) throw error
        expect(EK_ERROR_CODES).toContain(error.code)
        expect(state).toStrictEqual(before)
        refused[error.code] = (refused[error.code] ?? 0) + 1
      }
    }
    if (played === null) {
      const [first] = waitingPlayers(GAME, state)
      if (first === undefined) throw new Error("The game is on and waits for nobody")
      // The platform keeps the state alone, so the step is run here to read what happened: it must end where `playFor` ends
      const ctx = open(ORIGINAL_RULES, state)
      autoPlay(ctx, first)
      const result = close(ctx)
      expect(result.state).toStrictEqual(playFor(GAME, state, first))
      played = { before: state, action: null, state: result.state, events: result.events }
    }
    visit(played)
    state = played.state
    moves++
  }
  return { state, moves, refused }
}
