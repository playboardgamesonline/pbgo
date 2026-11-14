import { type PlayerInfo, type Rng, createRng } from "@pbgo/engine-kit"
import { step } from "./actions"
import { CATALOGUE, keyOfValue } from "./catalogue"
import { GAME } from "./game"
import { fullScore, valueOf } from "./machine"
import { setupGame } from "./setup"
import { CELLS, type Action, type Cell, type SkyjoLogEntry, type Stage, type State } from "./types"
import { playerView } from "./view"

/**
 * Helpers shared by the tests. They build states and actions and check invariants; the rules are never written again here (the one
 * exception is the scoring of a round in `simulation.test.ts`, written a second time on purpose, to be compared with the engine's).
 * Cards are named by their value and found by it in the state, because a test never knows which id a card holds.
 */

// --- Setting up

/**
 * The seed of the `i`th game of a test. The deal uses the LOW 32 bits of a seed and the ids of the cards the HIGH bits
 * (`sideSeed`), so two games only differ in both when their seeds differ in both: this one moves the two halves.
 */
export function seedOf(i: number): number {
  return (i + 1) * 2 ** 32 + (Math.imul(i + 1, 0x9e3779b1) >>> 0)
}

export const PLAYER_IDS = ["ana", "bob", "cleo", "dan", "eva", "fay", "gus", "hal", "ivy"] as const

/** The first `n` players of the tests, in seat order. */
export function players(n: number): PlayerInfo[] {
  return PLAYER_IDS.slice(0, n).map((id) => ({ id, nickname: id.toUpperCase() }))
}

/** A real game, set up and dealt: the players have to turn their two cards over. */
export function newState(n: number, seed: number = seedOf(0)): State {
  return setupGame({ players: players(n), seed })
}

// --- Reading a state by values

export function seatOf(state: State, playerId: string): number {
  const seat = state.seats.indexOf(playerId)
  if (seat < 0) throw new Error(`${playerId} is not at the table`)
  return seat
}

/** The value of the card that holds `id`. */
export function valueOfId(state: State, id: number): number {
  return valueOf(state, id)
}

/** The values of a pile, top first. */
export function values(state: State, ids: readonly number[]): number[] {
  return ids.map((id) => valueOf(state, id))
}

/** A grid as a test reads it: the value of every cell (`null` for a hole), and whether it is face up. */
export function gridValues(state: State, playerId: string): (number | null)[] {
  return state.grids[seatOf(state, playerId)]!.map((cell) => (cell === null ? null : valueOf(state, cell.card)))
}

export function gridUp(state: State, playerId: string): (boolean | null)[] {
  return state.grids[seatOf(state, playerId)]!.map((cell) => (cell === null ? null : cell.up))
}

/** Who the game waits for. */
export function waiting(state: State): string[] {
  return [...GAME.waitingFor!(state)]
}

export function viewOf(state: State, viewer: string | null) {
  return playerView(state, viewer)
}

// --- Rigging a table

/** A cell of a rigged grid: a number is a card face down, `up(n)` a card face up, `null` a hole. */
export type CellSpec = number | { up: number } | null | undefined
export const up = (value: number): CellSpec => ({ up: value })

export type StageSpec =
  | { kind: "reveal" }
  | { kind: "choose"; player: string }
  | { kind: "place"; player: string; card: number; from: "deck" | "discard" }
  | { kind: "flip"; player: string }
  | { kind: "between" }

export type Layout = {
  /** A number of players, or their ids. 3 when missing. */
  players?: number | readonly string[]
  /** The draw pile, top first, by value. The rest of the box follows below it (see `rest`). */
  deck?: readonly number[]
  /** The discard, top first, by value. One 5 when missing (a round has a card on it). */
  discard?: readonly number[]
  /** The 12 cells of each player's grid, `column * 3 + row`. What is not named is a card face down (1 to 12 in turn, never three equal in a column). */
  grids?: Record<string, readonly CellSpec[]>
  /** The dealer: the last player when missing. */
  dealer?: string
  /** What the round is doing. The turn of the first player when missing (`choose`). */
  stage?: StageSpec
  ender?: string | null
  /** Players who played their last turn (by name). */
  last?: readonly string[]
  /** The points of the finished rounds. */
  rounds?: number[][]
  seed?: number
  /** Where the cards of the box that nobody asked for go: the bottom of the draw pile (default), or nowhere (`"away"`). */
  rest?: "deck" | "away"
}

/**
 * A table the test rigged: the cards it names are where it says (the ids are the ones of a real game of that seed), the rest of the
 * box goes below the draw pile. Nothing is dealt: the state is exactly the one described.
 */
export function layout(spec: Layout = {}): State {
  const names = typeof spec.players === "number" ? PLAYER_IDS.slice(0, spec.players) : (spec.players ?? PLAYER_IDS.slice(0, 3))
  const base = setupGame({ players: names.map((id) => ({ id, nickname: id.toUpperCase() })), seed: spec.seed ?? seedOf(0) })
  const taken = new Set<number>()
  const take = (value: number): number => {
    const key = keyOfValue(value)
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
  const discard = (spec.discard ?? [5]).map(take)
  // what a test does not name is a card face down, worth 1 to 12 in turn: no column holds three equal ones, and no value runs out
  const grids = names.map((id, seat): Cell[] => {
    const cells = spec.grids?.[id] ?? []
    return Array.from({ length: CELLS }, (_, position): Cell => {
      const cell = cells[position] === undefined ? 1 + ((seat * CELLS + position) % 12) : cells[position]
      if (cell === null) return null
      return typeof cell === "number" ? { card: take(cell), up: false } : { card: take(cell.up), up: true }
    })
  })
  const stageSpec: StageSpec = spec.stage ?? { kind: "choose", player: names[0]! }
  const stage: Stage = (() => {
    switch (stageSpec.kind) {
      case "reveal":
      case "between":
        return { kind: stageSpec.kind }
      case "choose":
      case "flip":
        return { kind: stageSpec.kind, seat: seat(stageSpec.player) }
      case "place":
        return { kind: "place", seat: seat(stageSpec.player), card: take(stageSpec.card), from: stageSpec.from }
    }
  })()
  const rest = base.ids.filter((_, index) => !taken.has(index))
  return {
    ...base,
    deck: [...top, ...(spec.rest === "away" ? [] : rest)],
    discard,
    dealer,
    grids,
    stage,
    ender: spec.ender == null ? null : seat(spec.ender),
    last: (spec.last ?? []).map(seat),
    rounds: spec.rounds ?? [],
    stats: names.map(() => ({ columns: 0, ended: 0, doubled: 0 })),
  }
}

// --- Playing

export const reveal = (state: State, playerId: string, position: number): State => step(state, { type: "reveal", playerId, position }).state
export const take = (state: State, playerId: string): State => step(state, { type: "take", playerId }).state
export const draw = (state: State, playerId: string): State => step(state, { type: "draw", playerId }).state
export const place = (state: State, playerId: string, position: number): State => step(state, { type: "place", playerId, position }).state
export const discard = (state: State, playerId: string): State => step(state, { type: "discard", playerId }).state
export const flip = (state: State, playerId: string, position: number): State => step(state, { type: "flip", playerId, position }).state
export const deal = (state: State, playerId: string): State => step(state, { type: "deal", playerId }).state

/** The state once every player has turned the first two cards of their grid over (positions 0 and 1... in different columns: 0 and 3). */
export function opened(state: State): State {
  let s = state
  for (const id of state.seats) {
    s = reveal(s, id, 0)
    s = reveal(s, id, 3)
  }
  return s
}

/** The kinds of the events of a step, in order. */
export function kinds(result: { events: readonly SkyjoLogEntry[] }): string[] {
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
 * state. The tests call it after every move.
 */
export function problems(state: State): string[] {
  const found: string[] = []
  const n = state.seats.length
  const { ids } = state

  // every card is in exactly one place
  const held = state.stage.kind === "place" ? [state.stage.card] : []
  const placed = [...state.deck, ...state.discard, ...state.grids.flatMap((grid) => grid.flatMap((cell) => (cell ? [cell.card] : []))), ...held]
  if (ids.length !== CATALOGUE.length || new Set(ids).size !== ids.length) found.push("the ids are not 150 different numbers")
  if (placed.length !== ids.length || [...placed].sort((a, b) => a - b).join() !== [...ids].sort((a, b) => a - b).join()) {
    found.push(`the cards are not each in one place (${placed.length} placed of ${ids.length})`)
  }

  // one entry per seat, 12 cells each
  for (const [name, list] of Object.entries({ grids: state.grids, stats: state.stats })) {
    if (list.length !== n) found.push(`${name} has ${list.length} entries for ${n} seats`)
  }
  state.grids.forEach((grid, seat) => {
    if (grid.length !== CELLS) found.push(`${state.seats[seat]} has ${grid.length} cells`)
    // a hole comes with its whole column
    for (let column = 0; column < 4; column++) {
      const holes = grid.slice(column * 3, column * 3 + 3).filter((cell) => cell === null).length
      if (holes !== 0 && holes !== 3) found.push(`${state.seats[seat]} has a column that is half thrown away`)
      // a column of three equal cards face up is thrown away at once
      const cells = grid.slice(column * 3, column * 3 + 3)
      if (cells.every((cell) => cell?.up) && new Set(cells.map((cell) => valueOf(state, cell!.card))).size === 1) found.push(`${state.seats[seat]} keeps a column of three equal cards`)
    }
  })
  state.rounds.forEach((scores, round) => {
    if (scores.length !== n) found.push(`round ${round + 1} has ${scores.length} scores for ${n} seats`)
  })
  if (state.dealer < 0 || state.dealer >= n) found.push("the dealer is not at the table")
  if (state.discard.length === 0 && (state.stage.kind === "choose" || state.stage.kind === "flip")) found.push("the discard is empty between two moves of a round")

  // the closing turn
  if (state.ender !== null) {
    if (!state.last.includes(state.ender)) found.push("the ender has not played their last turn")
    if (new Set(state.last).size !== state.last.length) found.push("a last turn is counted twice")
    if (state.stage.kind === "choose" && state.last.includes(state.stage.seat)) found.push("a player plays their last turn twice")
  } else if (state.last.length > 0) found.push("last turns without an ender")
  if (state.stage.kind !== "between" && state.stage.kind !== "reveal") {
    // the first player with all their cards face up ends the round: nobody has them all up while the round is not ending
    state.grids.forEach((grid, seat) => {
      const allUp = grid.every((cell) => cell === null || cell.up)
      if (allUp && state.ender === null) found.push(`${state.seats[seat]} has every card face up and the round is not ending`)
    })
  }
  if (state.stage.kind === "between") {
    state.grids.forEach((grid, seat) => {
      if (grid.some((cell) => cell !== null && !cell.up)) found.push(`${state.seats[seat]} has a card face down after the count`)
    })
    if (state.rounds.length === 0) found.push("a round is counted and nothing is written down")
  }
  return found
}

/** The round's count of a seat, from the state: what a count of the grid gives, doubling aside. */
export const countOf = (state: State, seat: number): number => fullScore(state, seat)

// --- Random play

/** A legal move for one of the players the game waits for: the choices are the ones a table makes, at random. */
export function randomAction(state: State, rng: Rng): Action {
  const [first] = waiting(state)
  if (first === undefined) throw new Error("The game waits for nobody")
  const waits = waiting(state)
  const playerId = waits[Math.floor(rng() * waits.length)]!
  const seat = seatOf(state, playerId)
  const grid = state.grids[seat]!
  const pick = (wanted: (cell: NonNullable<Cell>) => boolean): number => {
    const options = grid.flatMap((cell, position) => (cell && wanted(cell) ? [position] : []))
    return options[Math.floor(rng() * options.length)]!
  }
  const { stage } = state
  switch (stage.kind) {
    case "reveal":
      return { type: "reveal", playerId, position: pick((cell) => !cell.up) }
    case "between":
      return { type: "deal", playerId }
    case "choose":
      return { type: rng() < 0.5 ? "take" : "draw", playerId }
    case "place":
      if (stage.from === "deck" && rng() < 0.4) return { type: "discard", playerId }
      return { type: "place", playerId, position: pick(() => true) }
    case "flip":
      return { type: "flip", playerId, position: pick((cell) => !cell.up) }
  }
}

/** Plays at random, for the players the game waits for, until `stop` says so. Gives every state met, the first one included. */
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

