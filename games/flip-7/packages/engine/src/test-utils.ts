import { type PlayerInfo, type Rng, createRng } from "@pbgo/engine-kit"
import { step } from "./actions"
import { CATALOGUE, type CardKey, cardType } from "./catalogue"
import { lineScore } from "./scoring"
import { GAME } from "./game"
import { setupGame } from "./setup"
import type { Action, Frame, PlayerView, PublicPhase, State, Status, Step } from "./types"
import { playerView } from "./view"

/**
 * Helpers shared by the tests. They build states and actions and check invariants; the rules are never written again here (the one
 * exception is the scoring in `simulation.test.ts`, written a second time on purpose, to be compared with the engine's).
 * Cards are named by their face (a key of `CARDS`) and found by it in the state, because a test never knows which id a card holds.
 */

// --- Setting up

/**
 * The seed of the `i`th game of a test. The deal uses the LOW 32 bits of a seed and the ids of the cards the HIGH bits
 * (`sideSeed`), so two games only differ in both when their seeds differ in both: this one moves the two halves.
 */
export function seedOf(i: number): number {
  return (i + 1) * 2 ** 32 + (Math.imul(i + 1, 0x9e3779b1) >>> 0)
}

export const PLAYER_IDS = ["ana", "bob", "cleo", "dan", "eva", "fay", "gus", "hal", "ivy", "jon", "kai", "lea", "max", "ned", "oli", "pam", "quin", "rex"] as const

/** The first `n` players of the tests, in seat order. */
export function players(n: number): PlayerInfo[] {
  return PLAYER_IDS.slice(0, n).map((id) => ({ id, nickname: id.toUpperCase() }))
}

/** A real game, set up and dealt. */
export function newState(n: number, seed: number = seedOf(0), options?: unknown): State {
  return setupGame({ players: players(n), options, seed })
}

export function viewOf(state: State, viewer: string | null): PlayerView {
  return playerView(state, viewer)
}

// --- Reading a state by faces

export function titleOf(state: State, id: number): CardKey {
  const key = CATALOGUE[state.ids.indexOf(id)]
  if (key === undefined) throw new Error(`No card holds the id ${id}`)
  return key
}

export function titles(state: State, ids: readonly number[]): CardKey[] {
  return ids.map((id) => titleOf(state, id))
}

export function seatOf(state: State, playerId: string): number {
  const seat = state.seats.indexOf(playerId)
  if (seat < 0) throw new Error(`${playerId} is not at the table`)
  return seat
}

/** The faces in front of a player, in the order they came. */
export function lineTitles(state: State, playerId: string): CardKey[] {
  return titles(state, state.lines[seatOf(state, playerId)]!)
}

/** The draw pile by face, top first. */
export function deckTitles(state: State): CardKey[] {
  return titles(state, state.deck)
}

/** The discard by face, top first. */
export function discardTitles(state: State): CardKey[] {
  return titles(state, state.discard)
}

export function statusOf(state: State, playerId: string): Status {
  return state.status[seatOf(state, playerId)]!
}

/** Who the game waits for: always one player, or nobody once it is over. */
export function waiting(state: State): string | undefined {
  return GAME.waitingFor!(state)[0]
}

/** What the game asks of the holder of an action card. */
export function decisionOf(state: State): Extract<PublicPhase, { kind: "target" }> {
  const { phase } = playerView(state, null)
  if (phase.kind !== "target") throw new Error(`The game is at "${phase.kind}", not at the choice of a target`)
  return phase
}

// --- Rigging a table

/** A frame by player name and face, the way a test writes it. */
export type FrameSpec =
  | { kind: "turn"; player: string; acted?: boolean }
  | { kind: "target"; player: string; card: CardKey }
  | { kind: "flip"; player: string; remaining: number; held?: readonly CardKey[] }
  | { kind: "deal"; given: number }

export type Layout = {
  /** A number of players, or their ids. 3 when missing. */
  players?: number | readonly string[]
  /** The draw pile, top first. The rest of the box follows below it, in catalogue order (see `rest`). */
  deck?: readonly CardKey[]
  /** The discard, top first. */
  discard?: readonly CardKey[]
  /** The faces in front of each player, in the order they came. A player who is not named has nothing. */
  lines?: Record<string, readonly CardKey[]>
  /** Every player is active unless told otherwise. */
  status?: Record<string, Status>
  /** The dealer: the last player when missing, so that the first player is the one on their left and plays first. */
  dealer?: string
  /** The stack of the round. The turn of the player on the left of the dealer when missing; `[]` for a table between two rounds. */
  stack?: readonly FrameSpec[]
  /** The points of the finished rounds. */
  rounds?: number[][]
  options?: Record<string, unknown>
  seed?: number
  /** Where the cards of the box that nobody asked for go: the bottom of the draw pile (default), the discard, or nowhere (`"away"`). */
  rest?: "deck" | "discard" | "away"
}

/**
 * A table the test rigged: the cards it names are where it says (the ids are the ones of a real game of that seed), the rest of the
 * box goes below the draw pile. Nothing is dealt and no round is run: the state is exactly the one described.
 */
export function layout(spec: Layout = {}): State {
  const names = typeof spec.players === "number" ? PLAYER_IDS.slice(0, spec.players) : (spec.players ?? PLAYER_IDS.slice(0, 3))
  const base = setupGame({ players: names.map((id) => ({ id, nickname: id.toUpperCase() })), options: spec.options, seed: spec.seed ?? seedOf(0) })
  const taken = new Set<number>()
  const take = (key: CardKey): number => {
    const index = CATALOGUE.findIndex((face, i) => face === key && !taken.has(i))
    if (index < 0) throw new Error(`The box holds no more "${key}"`)
    taken.add(index)
    return base.ids[index]!
  }
  const seat = (player: string): number => {
    const found = names.indexOf(player)
    if (found < 0) throw new Error(`${player} is not at the table`)
    return found
  }

  const dealer = spec.dealer === undefined ? names.length - 1 : seat(spec.dealer)
  const top = (spec.deck ?? []).map(take)
  const discard = (spec.discard ?? []).map(take)
  const lines = names.map((id) => (spec.lines?.[id] ?? []).map(take))
  const status = names.map((id): Status => spec.status?.[id] ?? "active")
  const stack: Frame[] = (spec.stack ?? [{ kind: "turn", player: names[(dealer + 1) % names.length]! }]).map((frame): Frame => {
    switch (frame.kind) {
      case "turn":
        return { kind: "turn", seat: seat(frame.player), acted: frame.acted ?? false }
      case "target":
        return { kind: "target", seat: seat(frame.player), card: take(frame.card) }
      case "flip":
        return { kind: "flip", seat: seat(frame.player), remaining: frame.remaining, held: (frame.held ?? []).map(take) }
      case "deal":
        return { kind: "deal", given: frame.given }
    }
  })
  const rest = base.ids.filter((_, index) => !taken.has(index))
  const where = spec.rest ?? "deck"

  return {
    ...base,
    deck: [...top, ...(where === "deck" ? rest : [])],
    discard: [...discard, ...(where === "discard" ? rest : [])],
    dealer,
    lines,
    status,
    stack,
    rounds: spec.rounds ?? [],
    stats: names.map(() => ({ busts: 0, flip7: 0 })),
  }
}

// --- Playing

export const hit = (state: State, playerId: string): State => step(state, { type: "hit", playerId }).state
export const stay = (state: State, playerId: string): State => step(state, { type: "stay", playerId }).state
export const give = (state: State, playerId: string, target: string): State => step(state, { type: "target", playerId, target }).state
export const deal = (state: State, playerId: string): State => step(state, { type: "deal", playerId }).state

/** The kinds of the events of a step, in order. */
export function kinds(result: Step): string[] {
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

const duplicates = (values: readonly number[]) => values.length !== new Set(values).size

/** The value of a face when it is a number card. */
const valueOf = (face: CardKey): number[] => {
  const card = cardType(face)
  return card.kind === "number" ? [card.value] : []
}

/**
 * What must hold for any state of the game, in the middle of a round or not. Gives what does not, one sentence each: `[]` is a sound
 * state. The tests call it after every move.
 */
export function problems(state: State): string[] {
  const found: string[] = []
  const n = state.seats.length
  const { ids } = state

  // every card is in exactly one place
  const held = state.stack.flatMap((frame) => (frame.kind === "flip" ? frame.held : frame.kind === "target" ? [frame.card] : []))
  const placed = [...state.deck, ...state.discard, ...state.lines.flat(), ...held]
  if (ids.length !== CATALOGUE.length || new Set(ids).size !== ids.length) found.push("the ids are not 94 different numbers")
  if (placed.length !== ids.length || [...placed].sort((a, b) => a - b).join() !== [...ids].sort((a, b) => a - b).join()) {
    found.push(`the cards are not each in one place (${placed.length} placed of ${ids.length})`)
  }

  // one entry per seat
  for (const [name, list] of Object.entries({ lines: state.lines, status: state.status, stats: state.stats })) {
    if (list.length !== n) found.push(`${name} has ${list.length} entries for ${n} seats`)
  }
  state.rounds.forEach((scores, round) => {
    if (scores.length !== n || scores.some((points) => !Number.isInteger(points) || points < 0)) found.push(`round ${round + 1} has odd scores`)
  })
  if (state.dealer < 0 || state.dealer >= n) found.push("the dealer is not at the table")

  // what a line holds follows from the status
  state.lines.forEach((line, seat) => {
    const who = state.seats[seat]
    const faces = line.map((id) => CATALOGUE[ids.indexOf(id)]!)
    const numbers = faces.flatMap(valueOf)
    const status = state.status[seat]
    if (status === "busted" && !duplicates(numbers)) found.push(`${who} is busted without a duplicate`)
    if (status !== "busted" && duplicates(numbers)) found.push(`${who} holds a duplicate and is not busted`)
    if (faces.filter((face) => face === "second-chance").length > 1) found.push(`${who} holds two Second Chance`)
    if (status === "frozen" && !faces.includes("freeze")) found.push(`${who} is frozen without a Freeze`)
  })

  // a settled stack
  const top = state.stack.at(-1)
  if (top !== undefined) {
    if (top.kind !== "turn" && top.kind !== "target") found.push(`the last frame is a ${top.kind}: the round is not settled`)
    if (top.kind === "turn" && (top.acted || state.status[top.seat] !== "active")) found.push("the turn is not the one of an active player waiting to act")
    // a round rests on one frame: the opening deal, then the turns; whatever sits above it is a decision or a Flip Three
    const roots = state.stack.filter((frame) => frame.kind === "turn" || frame.kind === "deal")
    if (roots.length !== 1 || state.stack[0] !== roots[0]) found.push("a round holds one deal or turn, at the bottom of the stack")
    if (state.stack.slice(1).some((frame) => frame.kind === "deal" || frame.kind === "turn")) found.push("a deal or a turn sits above another frame")
    if (!state.status.includes("active")) found.push("a round goes on with nobody in")
    state.lines.forEach((line, seat) => {
      const faces = line.map((id) => CATALOGUE[ids.indexOf(id)]!)
      const distinct = new Set(faces.flatMap(valueOf))
      if (distinct.size >= 7) found.push(`${state.seats[seat]} holds a Flip 7 and the round goes on`)
    })
  } else if (state.status.includes("active")) found.push("a round is over and somebody is still in")
  return found
}

/** The most a line of this face list can be worth: used by the simulation to compare. */
export const scoreOf = (faces: readonly CardKey[]): number => lineScore(faces.map(cardType))

// --- Fuzz and storage

/** Freezes a value and everything in it: a step that mutates its input throws. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

/**
 * The way Postgres `jsonb` gives a value back: the keys of every object shortest first, then alphabetically, whatever order they were
 * written in. The state must mean the same after it.
 */
export function reorderKeys<T>(value: T): T {
  const sorted = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sorted)
    if (!v || typeof v !== "object") return v
    const keys = Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(keys.map((key) => [key, sorted((v as Record<string, unknown>)[key])]))
  }
  return sorted(JSON.parse(JSON.stringify(value))) as T
}

/** A legal move for the player the game waits for: the choices are the ones a table makes, at random. */
export function randomAction(state: State, rng: Rng): Action {
  const top = state.stack.at(-1)
  const playerId = waiting(state)
  if (playerId === undefined) throw new Error("The game waits for nobody")
  if (top === undefined) return { type: "deal", playerId }
  if (top.kind === "turn") {
    const canStay = state.lines[top.seat]!.length > 0
    return canStay && rng() < 0.4 ? { type: "stay", playerId } : { type: "hit", playerId }
  }
  const { phase } = playerView(state, playerId)
  if (phase.kind !== "target") throw new Error("A target was expected")
  return { type: "target", playerId, target: phase.targets[Math.floor(rng() * phase.targets.length)]! }
}

/** Plays at random, for the player the game waits for, until `stop` says so. Gives every state met, the first one included. */
export function playRandomly(state: State, seed: number, stop: (state: State) => boolean = () => false, maxMoves = 5000): State[] {
  const rng = createRng(seed)
  const seen = [state]
  let current = state
  for (let i = 0; i < maxMoves && waiting(current) !== undefined && !stop(current); i++) {
    current = step(current, randomAction(current, rng)).state
    seen.push(current)
  }
  return seen
}
