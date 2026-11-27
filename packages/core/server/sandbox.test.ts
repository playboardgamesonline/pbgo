import type { AnyGameDefinition } from "@pbgo/engine-kit"
import { describe, expect, it, vi } from "vitest"
import type { PlayableGame } from "../lib/binding"
import { sandboxAction, sandboxDebug, sandboxLoad, sandboxNew, sandboxPlayFor, sandboxTableOf, sandboxView } from "./sandbox"

vi.mock("server-only", () => ({}))
vi.mock("./admin", () => ({ isAdmin: async () => false }))

// A race to 6: each player in turn adds 1 or 2 to a shared count, and the move is said in the log. `jump` takes the count to 5.
type State = { count: number; turn: number; seats: string[]; seed: number }
const over = (s: State) => s.count >= 6
const add = (s: State, by: number): State => ({ ...s, count: s.count + by, turn: s.turn + 1 })
const GAME = {
  id: "race",
  name: "Race",
  minPlayers: 2,
  maxPlayers: 4,
  options: {},
  clientActions: ["add"],
  setup: ({ players, seed }: { players: { id: string }[]; seed: number }) => ({ count: 0, turn: 0, seats: players.map((p) => p.id), seed }),
  apply: (s: State, a: { by: number }) => add(s, a.by),
  step: (s: State, a: { by: number; playerId: string }) => {
    if (s.seats[s.turn % s.seats.length] !== a.playerId) throw Object.assign(new Error("NOT_YOUR_TURN"), { name: "EngineError", code: "NOT_YOUR_TURN" })
    return { state: add(s, a.by), events: [{ event: { who: a.playerId, by: a.by } }] }
  },
  view: (s: State, id: string | null) => ({ count: s.count, me: id }),
  isOver: over,
  waitingFor: (s: State) => (over(s) ? [] : [s.seats[s.turn % s.seats.length]!]),
  autoPlayFor: (s: State) => add(s, 1),
  autoPlayStep: (s: State, id: string) => ({ state: add(s, 1), events: [{ event: { who: id, by: 1 } }] }),
  debug: { turn: (s: State) => add(s, 1), jump: (s: State) => ({ ...s, count: 5 }) },
} as unknown as AnyGameDefinition

const game = { slug: "race", binding: { GAME } } as unknown as PlayableGame
const options = { defaults: {}, hidden: [] }
const setup = { players: 3, turns: 0, scenario: null, seed: 11, seat: 0 }

describe("a made-up table", () => {
  it("seats the made-up players and deals from the seed", () => {
    const table = sandboxNew(game, setup, options)
    expect(table.players.map((p) => p.id)).toEqual(["preview-1", "preview-2", "preview-3"])
    expect(table.seed).toBe(11)
    expect(table.state).toMatchObject({ count: 0, seed: 11 })
  })

  it("plays the turns asked for, then the situation asked for", () => {
    expect((sandboxNew(game, { ...setup, turns: 2 }, options).state as State).count).toBe(2)
    expect((sandboxNew(game, { ...setup, turns: 2, scenario: "jump" }, options).state as State).count).toBe(5)
    // A situation the game does not have is no situation
    expect((sandboxNew(game, { ...setup, scenario: "nothing" }, options).state as State).count).toBe(0)
  })

  it("plays a move of the seat looked from, as the action route does, and keeps what it said", () => {
    const table = sandboxAction(game, sandboxNew(game, setup, options), "preview-1", { type: "add", by: 2 })
    expect((table.state as State).count).toBe(2)
    expect(table.version).toBe(2)
    expect(table.steps.at(-1)).toEqual({ version: 2, entries: [{ event: { who: "preview-1", by: 2 } }] })
    expect(() => sandboxAction(game, table, "preview-1", { type: "add", by: 1 })).toThrow("NOT_YOUR_TURN")
    expect(() => sandboxAction(game, table, "preview-2", { type: "cheat" })).toThrow("INVALID_ACTION")
  })

  it("plays for the players the game waits for, and only them", () => {
    const table = sandboxNew(game, setup, options)
    expect((sandboxPlayFor(game, table).state as State).count).toBe(1)
    expect((sandboxPlayFor(game, table, ["preview-2"]).state as State).count).toBe(0)
  })

  it("runs the commands of the debug panel, and deals again on start", () => {
    const table = sandboxDebug(game, sandboxNew(game, setup, options), "jump", options)
    expect((table.state as State).count).toBe(5)
    const over = sandboxDebug(game, table, "turn", options)
    expect(over.over).toBe(true)
    const again = sandboxDebug(game, over, "start", options)
    expect(again.over).toBe(false)
    expect(again.version).toBeGreaterThan(over.version)
    expect(() => sandboxDebug(game, table, "nothing", options)).toThrow("INVALID_ACTION")
  })

  it("loads a state saved from another table with as many seats", () => {
    const table = sandboxNew(game, setup, options)
    const saved = { game: "race", players: ["a", "b", "c"], state: { count: 3, turn: 1, seats: ["a", "b", "c"], seed: 1 }, savedAt: "" }
    expect(sandboxLoad(game, table, saved).state).toEqual({ count: 3, turn: 1, seats: ["preview-1", "preview-2", "preview-3"], seed: 1 })
    expect(() => sandboxLoad(game, table, { ...saved, game: "other" })).toThrow("INVALID_STATE")
  })

  it("takes back only a table of made-up players", () => {
    const table = sandboxNew(game, setup, options)
    expect(sandboxTableOf(game, JSON.parse(JSON.stringify(table)))).toEqual(table)
    expect(() => sandboxTableOf(game, { ...table, players: [{ id: "someone", nickname: "X" }] })).toThrow("INVALID_STATE")
    expect(() => sandboxTableOf(game, null)).toThrow("INVALID_STATE")
  })

  it("is seen from the seat asked for, with everybody present and the log as that seat reads it", () => {
    const table = sandboxAction(game, sandboxNew(game, setup, options), "preview-1", { type: "add", by: 1 })
    const view = sandboxView(game, table, "preview-2")
    expect(view).toMatchObject({ code: "PREVIEW", meId: "preview-2", status: "playing", waitingFor: ["preview-2"], view: { count: 1, me: "preview-2" } })
    expect(view.present).toEqual(["preview-1", "preview-2", "preview-3"])
    expect(view.log).toEqual([{ v: 2, event: { who: "preview-1", by: 1 } }])
    expect(sandboxView(game, table, "stranger").meId).toBe("preview-1")
  })
})
