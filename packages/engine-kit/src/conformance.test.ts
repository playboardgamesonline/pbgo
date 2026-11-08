import { describe, expect, it } from "vitest"
import { conformanceProblems, type ConformanceOptions, deepEqual, deepFreeze, jsonProblems, reorderKeys } from "./conformance"
import type { GameDefinition, Results } from "./contract"
import { EngineError } from "./errors"
import { normalizeOptions, type OptionDefinitions } from "./options"
import { assertPlayers } from "./players"
import { createSaveableRng, restoreRng } from "./rng"
import { leaders, ranks } from "./rounds"

// A small game that keeps the contract (a race to a target, one roll after the other, with a secret for each seat), then the same game broken one rule at a time: the suite must say which.

type State = {
  seats: string[]
  scores: Record<string, number>
  rolls: Record<string, number>
  turn: number
  target: number
  mode: string
  rush: boolean
  rng: number
  secrets: string[]
  over: boolean
}
type Roll = { type: "roll"; playerId: string }
type View = { scores: { id: string; points: number }[]; turn: string | null; me: { secret: string } | null; results: Results | null }

const OPTIONS: OptionDefinitions = {
  target: { type: "number", defaultValue: 12, min: 6, max: 30 },
  mode: { type: "choice", defaultValue: "plain", choices: [{ value: "plain" }, { value: "double" }] },
  rush: { type: "boolean", defaultValue: false },
}

function makeSetup(check: boolean): GameDefinition<State, Roll, View>["setup"] {
  return ({ players, options, seed = 1 }) => {
    if (check) assertPlayers(players, { min: 2, max: 4 })
    const values = normalizeOptions(OPTIONS, options)
    const ids = players.map((p) => p.id)
    return {
      seats: ids,
      scores: Object.fromEntries(ids.map((id) => [id, 0])),
      rolls: Object.fromEntries(ids.map((id) => [id, 0])),
      turn: 0,
      target: values.target as number,
      mode: values.mode as string,
      rush: values.rush as boolean,
      rng: createSaveableRng(seed).save(),
      secrets: ids.map((_, i) => `secret-${seed}-${i}`),
      over: false,
    }
  }
}

function roll(state: State, playerId: string): State {
  if (state.over) throw new EngineError("GAME_OVER")
  if (!state.seats.includes(playerId)) throw new EngineError("UNKNOWN_PLAYER")
  if (state.seats[state.turn] !== playerId) throw new EngineError("NOT_YOUR_TURN")
  const rng = restoreRng(state.rng)
  const amount = ((1 + Math.floor(rng() * 6)) * (state.mode === "double" ? 2 : 1)) + (state.rush ? 1 : 0)
  const scores = { ...state.scores, [playerId]: state.scores[playerId]! + amount }
  return { ...state, scores, rolls: { ...state.rolls, [playerId]: state.rolls[playerId]! + 1 }, turn: (state.turn + 1) % state.seats.length, rng: rng.save(), over: scores[playerId]! >= state.target }
}

function resultsOf(state: State): Results {
  const totals = state.seats.map((id) => state.scores[id]!)
  const rank = ranks(totals, "high")
  return {
    players: state.seats.map((id, i) => ({ playerId: id, total: totals[i]!, rank: rank[i]!, detail: [{ key: "rolls", points: state.rolls[id]! }] })),
    winners: leaders(totals, "high").map((i) => state.seats[i]!),
  }
}

/** The same race played on one side: the table wins together when its score is even, and loses together otherwise. */
function coopResultsOf(state: State): Results {
  const score = state.seats.reduce((sum, id) => sum + state.scores[id]!, 0)
  const won = score % 2 === 0
  return {
    players: state.seats.map((id) => ({ playerId: id, total: score, rank: 1, detail: [{ key: "rolls", points: state.rolls[id]! }] })),
    winners: won ? [...state.seats] : [],
    coop: won ? "won" : "lost",
  }
}

const waiting = (state: State): string[] => (state.over ? [] : [state.seats[state.turn]!])

const dash: GameDefinition<State, Roll, View> = {
  id: "dash",
  name: "Dash",
  minPlayers: 2,
  maxPlayers: 4,
  options: OPTIONS,
  scoreLines: ["rolls"],
  clientActions: ["roll"],
  setup: makeSetup(true),
  apply: (state, action) => {
    if (action?.type !== "roll") throw new EngineError("INVALID_ACTION")
    return roll(state, action.playerId)
  },
  view: (state, playerId) => {
    const seat = state.seats.indexOf(playerId ?? "")
    return {
      scores: state.seats.map((id) => ({ id, points: state.scores[id]! })),
      turn: state.over ? null : (state.seats[state.turn] ?? null),
      me: seat >= 0 ? { secret: state.secrets[seat]! } : null,
      results: state.over ? resultsOf(state) : null,
    }
  },
  isOver: (state) => state.over,
  waitingFor: waiting,
  autoPlayFor: (state, playerId) => {
    if (!waiting(state).includes(playerId)) throw new EngineError("NOT_WAITING")
    return roll(state, playerId)
  },
}

const secretsFor = (state: State, viewer: string | null) => state.secrets.filter((_, i) => state.seats[i] !== viewer)

/** The sentences the suite says about a game, one per line. */
const said = (game: GameDefinition<State, Roll, View>, extra: ConformanceOptions = {}) =>
  conformanceProblems(game, { seeds: 2, variantSeeds: 1, playerCounts: [2, 3], secretsFor, errorCodes: [], ...extra }).join("\n")

/** The game, with one part of it broken. */
const broken = (patch: Partial<GameDefinition<State, Roll, View>>) => ({ ...dash, ...patch }) as GameDefinition<State, Roll, View>

describe("a game that keeps the contract", () => {
  it("has nothing said about it, at every table size and for every variant of its options", () => {
    expect(conformanceProblems(dash, { secretsFor, errorCodes: [] })).toEqual([])
  })
})

describe("the definition", () => {
  it("is refused when the bounds of a table are not whole numbers in order", () => {
    expect(said(broken({ minPlayers: 5, maxPlayers: 2 }))).toContain("the bounds of a table")
  })

  it("is refused when the server cannot play for an absent player", () => {
    expect(said(broken({ autoPlayFor: undefined }))).toContain("the server cannot play for an absent player")
  })

  it("is refused when an option's default is outside its range or among no choice", () => {
    expect(said(broken({ options: { ...OPTIONS, target: { type: "number", defaultValue: 99, min: 6, max: 30 } } }))).toContain("an option's default is outside its range")
    expect(said(broken({ options: { ...OPTIONS, mode: { type: "choice", defaultValue: "slow", choices: [{ value: "plain" }] } } }))).toContain("a choice option's default is not one of its choices")
  })

  it("is refused when an option names one that does not exist", () => {
    expect(said(broken({ options: { ...OPTIONS, rush: { type: "boolean", defaultValue: false, requires: ["nope"] } } }))).toContain("an option names an option that does not exist")
  })

  it("is refused when an option or a preset carries words, unless the game has not moved them yet", () => {
    const withWords = broken({ options: { ...OPTIONS, rush: { type: "boolean", defaultValue: false, label: "Rush" } }, presets: [{ id: "quick", label: "Quick", values: { rush: true } }] })
    expect(said(withWords)).toContain("an option carries words")
    expect(said(withWords)).toContain("a preset carries words")
    expect(said(withWords, { allowTexts: true })).toBe("")
  })

  it("is refused when a preset sets an option that does not exist or when two presets share an id", () => {
    expect(said(broken({ presets: [{ id: "a", values: { nope: 1 } }] }))).toContain("a preset sets an option that does not exist")
    expect(said(broken({ presets: [{ id: "a", values: {} }, { id: "a", values: {} }] }))).toContain("two presets have the same id")
  })

  it("is refused when it lists a line of score twice, or when a line of the results is not listed", () => {
    expect(said(broken({ scoreLines: ["rolls", "rolls"] }))).toContain("scoreLines lists a line twice")
    expect(said(broken({ scoreLines: ["other"] }))).toContain("a line of the score is not in the definition's scoreLines")
  })
})

describe("setup", () => {
  it("must refuse a table it cannot play", () => {
    expect(said(broken({ setup: makeSetup(false) }))).toContain("setup accepts a table it cannot play")
  })

  it("must refuse it with INVALID_PLAYERS", () => {
    const other = broken({
      setup: (args) => {
        try {
          return dash.setup(args)
        } catch {
          throw new EngineError("BAD_TABLE")
        }
      },
    })
    expect(said(other)).toContain("with another code than INVALID_PLAYERS")
    expect(said(broken({ setup: () => { throw new Error("boom") } }))).toContain("setup throws a plain error for a table it cannot play")
  })

  it("must give the same game for the same seed", () => {
    let count = 0
    expect(said(broken({ setup: (args) => ({ ...dash.setup(args), stamp: count++ }) as State }))).toContain("the same seed does not give the same game")
  })

  it("may not ask the dice or the clock once it has a seed", () => {
    expect(said(broken({ setup: (args) => (Math.random(), dash.setup(args)) }))).toContain("the engine calls Math.random")
    expect(said(broken({ autoPlayFor: (state, id) => (Date.now(), dash.autoPlayFor!(state, id)) }))).toContain("the engine calls Date.now")
  })
})

describe("the state", () => {
  it("must be plain JSON", () => {
    expect(said(broken({ setup: (args) => ({ ...dash.setup(args), seen: new Set<string>() }) as State }))).toContain("the state is not plain JSON")
    expect(said(broken({ setup: (args) => ({ ...dash.setup(args), extra: undefined }) as State }))).toContain("is undefined (it vanishes in jsonb)")
  })

  it("must not hold a nickname", () => {
    expect(said(broken({ setup: (args) => ({ ...dash.setup(args), names: args.players.map((p) => p.nickname) }) as State }))).toContain("the state holds a nickname")
  })

  it("must be left as it was by a step, which returns a new one", () => {
    expect(said(broken({ autoPlayFor: (state, id) => ((state.turn = 0), dash.autoPlayFor!(state, id)) }))).toContain("a step writes to the state it was given")
  })

  it("must give the same game once jsonb has reordered its keys", () => {
    const byKeys = broken({ waitingFor: (state) => (state.over ? [] : [Object.keys(state.scores)[state.turn]!]) })
    expect(said(byKeys)).toContain("reordered the keys")
  })
})

describe("who the game waits for", () => {
  it("is a list of seated players, once each, in seat order, and nobody once the game is over", () => {
    expect(said(broken({ waitingFor: (s) => (s.over ? [] : [s.seats[s.turn]!, s.seats[s.turn]!]) }))).toContain("waitingFor lists a player twice")
    expect(said(broken({ waitingFor: (s) => (s.over ? [] : ["nobody-here"]) }))).toContain("waitingFor names somebody who is not at the table")
    expect(said(broken({ waitingFor: (s) => (s.over ? [] : [...s.seats].reverse()) }))).toContain("waitingFor is not in seat order")
    expect(said(broken({ waitingFor: (s) => [s.seats[s.turn]!] }))).toContain("waitingFor names somebody once the game is over")
    expect(said(broken({ waitingFor: (s) => (s.over ? [] : (7 as never)) }))).toContain("waitingFor does not return a list of player ids")
  })

  it("is somebody as long as the game is not over", () => {
    expect(said(broken({ waitingFor: () => [] }))).toContain("the game is not over and waits for nobody")
  })
})

describe("autoPlayFor", () => {
  it("must move the game on", () => {
    expect(said(broken({ autoPlayFor: (state) => state }))).toContain("autoPlayFor changes nothing")
  })

  it("must end the game", () => {
    expect(said(broken({ autoPlayFor: (state, id) => ({ ...dash.autoPlayFor!(state, id), over: false }) }), { maxSteps: 40 })).toContain("a game does not end within 40 steps")
  })

  it("must give the same state for the same state", () => {
    let calls = 0
    const drifting = broken({
      autoPlayFor: (state, id) => {
        const next = dash.autoPlayFor!(state, id)
        return ++calls % 2 ? next : { ...next, scores: { ...next.scores, [id]: next.scores[id]! + 100 } }
      },
    })
    expect(said(drifting)).toContain("autoPlayFor gives two different states for the same state")
  })
})

describe("views", () => {
  it("must not show what their viewer must not know", () => {
    expect(said(broken({ view: (s, v) => ({ ...dash.view(s, v), leak: s.secrets }) as View }))).toContain("a view shows what its viewer must not know")
  })

  it("must not hold a nickname", () => {
    expect(said(broken({ view: (s, v) => ({ ...dash.view(s, v), names: ["Nickname 1"] }) as View }))).toContain("a view holds a nickname")
  })

  it("must be plain JSON", () => {
    expect(said(broken({ view: (s, v) => ({ ...dash.view(s, v), when: new Date(0) }) as View }))).toContain("a view is not plain JSON")
  })

  it("must carry the results from the end of the game and not before", () => {
    expect(said(broken({ view: (s, v) => ({ ...dash.view(s, v), results: { players: [], winners: [] } }) }))).toContain("the view carries results before the game is over")
    expect(said(broken({ view: (s, v) => ({ ...dash.view(s, v), results: null }) }))).toContain("the view of a finished game carries no results")
  })
})

describe("results", () => {
  const withResults = (change: (results: Results) => Results) =>
    broken({ view: (s, v) => ({ ...dash.view(s, v), results: s.over ? change(resultsOf(s)) : null }) })

  it("hold each player once, with a finite total", () => {
    expect(said(withResults((r) => ({ ...r, players: r.players.slice(1) })))).toContain("the results do not hold each player of the table exactly once")
    expect(said(withResults((r) => ({ ...r, players: r.players.map((p) => ({ ...p, total: Number.NaN })) })))).toContain("a result has a total that is not a finite number")
  })

  it("rank the players the way the kit does, a tie sharing a rank", () => {
    expect(said(withResults((r) => ({ ...r, players: r.players.map((p) => ({ ...p, rank: 2 })) })))).toContain("the ranks do not follow the competition ranking")
  })

  it("name winners who sit at the table, have rank 1, and are all the players of rank 1", () => {
    expect(said(withResults((r) => ({ ...r, winners: [] })))).toContain("a finished game names no winner")
    expect(said(withResults((r) => ({ ...r, winners: "a" as unknown as string[] })))).toContain("the winners are not a list of player ids")
    expect(said(withResults((r) => ({ ...r, winners: ["stranger-1"] })))).toContain("a winner is not at the table")
    expect(said(withResults((r) => ({ ...r, winners: [...r.winners, ...r.players.filter((p) => p.rank > 1).map((p) => p.playerId)] })))).toContain("a winner does not have rank 1")
    expect(said(withResults((r) => ({ ...r, winners: r.winners.slice(0, 1), players: r.players.map((p) => ({ ...p, rank: 1 })) })), { playerCounts: [3] })).toContain("a player of rank 1 is not among the winners")
  })

  it("have lines of score with a key and finite points, and no words unless the game has not moved them yet", () => {
    expect(said(withResults((r) => ({ ...r, players: r.players.map((p) => ({ ...p, detail: [{ key: "", points: 1 }] })) })))).toContain("a line of the score has no key")
    expect(said(withResults((r) => ({ ...r, players: r.players.map((p) => ({ ...p, detail: [{ key: "rolls", points: Number.NaN }] })) })))).toContain("points that are not a finite number")
    const worded = withResults((r) => ({ ...r, players: r.players.map((p) => ({ ...p, detail: [{ key: "rolls", label: "Rolls", points: 1 }] })) }))
    expect(said(worded)).toContain("a line of the score carries words")
    expect(said(worded, { allowTexts: true })).toBe("")
  })
})

describe("results of a game the table plays together", () => {
  const together = (change: (results: Results) => Results = (r) => r) =>
    broken({ view: (s, v) => ({ ...dash.view(s, v), results: s.over ? change(coopResultsOf(s)) : null }) })

  it("have nothing said about them, whether the table wins or loses", () => {
    expect(said(together())).toBe("")
    // Both ends are played by the seeds of the run, or the line above would prove half of the rule
    const ends = new Set<string>()
    said(together((r) => (ends.add(r.coop!), r)))
    expect([...ends].sort()).toEqual(["lost", "won"])
  })

  it("say whether the table won or lost, and nothing else", () => {
    expect(said(together((r) => ({ ...r, coop: "tied" as "won" })))).toContain('coop is neither "won" nor "lost"')
  })

  it("give every player rank 1 and the table's score", () => {
    expect(said(together((r) => ({ ...r, players: r.players.map((p, i) => ({ ...p, rank: i + 1 })) })))).toContain("every player has rank 1")
    expect(said(together((r) => ({ ...r, players: r.players.map((p, i) => ({ ...p, total: p.total + i })) })))).toContain("every player has the table's score as total")
  })

  it("name everybody among the winners when the table won, and nobody when it lost", () => {
    expect(said(together((r) => (r.coop === "won" ? { ...r, winners: r.winners.slice(1) } : r)))).toContain("a table that won together must name every player among the winners")
    expect(said(together((r) => (r.coop === "lost" ? { ...r, winners: r.players.map((p) => p.playerId).slice(0, 1) } : r)))).toContain("a table that lost together must name no winner")
  })

  it("do not excuse a game that does not say it is played together from naming a winner", () => {
    const silent = together((r) => {
      const plain = { ...r }
      delete plain.coop
      return plain
    })
    expect(said(silent)).toContain("a finished game names no winner")
  })
})

describe("junk actions", () => {
  it("must be refused with an EngineError, not a plain error", () => {
    const plain = broken({
      apply: (s, a) => {
        if (a?.type !== "roll") throw new Error("boom")
        return dash.apply(s, a)
      },
    })
    expect(said(plain)).toContain("apply throws a plain error on a malformed action")
  })

  it("must not be accepted when they are not the game's", () => {
    expect(said(broken({ apply: (s, a) => (a?.type === "roll" ? dash.apply(s, a) : s) }))).toContain("apply accepts an action that is not one of the game's")
  })

  it("must not write to the state while refusing them", () => {
    const touching = broken({
      apply: (s, a) => {
        if (a?.type !== "roll") {
          s.turn = 1
          throw new EngineError("INVALID_ACTION")
        }
        return dash.apply(s, a)
      },
    })
    expect(said(touching)).toContain("a step writes to the state it was given")
  })

  it("must carry a code of the vocabulary: a shared one, or one the game lists", () => {
    const own = broken({
      apply: (s, a) => {
        if (a?.type !== "roll") throw new EngineError("MY_CODE")
        return dash.apply(s, a)
      },
    })
    expect(said(own)).toContain("a refusal has a code that is neither shared nor in the game's ERROR_CODES")
    expect(said(own, { errorCodes: ["MY_CODE"] })).toBe("")
    expect(said(own, { errorCodes: undefined })).toBe("")
  })
})

describe("the helpers a test of an engine can use", () => {
  it("deepFreeze makes every level read only", () => {
    const state = deepFreeze({ a: { b: [1, { c: 2 }] } })
    expect(() => {
      ;(state.a.b[1] as { c: number }).c = 3
    }).toThrow(TypeError)
  })

  it("reorderKeys gives a value back as jsonb does: keys shortest first, then alphabetical, nothing JSON cannot hold", () => {
    const stored = reorderKeys({ "long-id": 1, x1: 2, b: { zz: 1, a: 2 }, gone: undefined })
    expect(Object.keys(stored)).toEqual(["b", "x1", "long-id"])
    expect(Object.keys(stored.b)).toEqual(["a", "zz"])
  })

  it("deepEqual compares arrays in order and objects in any, a missing field being an undefined one", () => {
    expect(deepEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true)
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual({ a: 1 }, null)).toBe(false)
  })

  it("jsonProblems names what plain data cannot hold", () => {
    const loop: Record<string, unknown> = {}
    loop.self = loop
    expect(jsonProblems({ ok: [1, "a", true, null, { deep: 0 }] })).toEqual([])
    expect(jsonProblems({ a: undefined, b: Number.NaN, c: () => 1, d: new Map(), e: new Date(0), f: 1n, g: loop }, "state")).toEqual([
      "state.a is undefined (it vanishes in jsonb)",
      "state.b is NaN",
      "state.c is a function",
      "state.d is a Map, not plain data",
      "state.e is a Date, not plain data",
      "state.f is a bigint",
      "state.g.self points back at itself",
    ])
  })
})
