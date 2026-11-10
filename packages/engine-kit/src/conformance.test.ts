import { describe, expect, it } from "vitest"
import { conformanceProblems, type ConformanceOptions, deepEqual, deepFreeze, jsonProblems, reorderKeys } from "./conformance"
import type { AnyGameDefinition, GameDefinition, Results, Standing } from "./contract"
import { isSystemAction, systemAction } from "./deadline"
import { EngineError } from "./errors"
import type { LogEntry, Step } from "./log"
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
  /** The time the step ends at, for the game with a clock */
  deadline?: number | null
}
type Roll = { type: "roll"; playerId: string; at?: number }
type View = { scores: { id: string; points: number }[]; turn: string | null; me: { secret: string } | null; results: Results | null; standings?: Standing[] }

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
  progress: (state) => Math.min(100, (Math.max(...Object.values(state.scores)) / state.target) * 100),
  waitingFor: waiting,
  autoPlayFor: (state, playerId) => {
    if (!waiting(state).includes(playerId)) throw new EngineError("NOT_WAITING")
    return roll(state, playerId)
  },
}

const secretsFor = (state: State, viewer: string | null) => state.secrets.filter((_, i) => state.seats[i] !== viewer)

/** The sentences the suite says about a game, one per line. */
const said = (game: AnyGameDefinition, extra: ConformanceOptions = {}) =>
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

describe("progress", () => {
  it("is not asked of a game that does not say how far it has come", () => {
    expect(said(broken({ progress: undefined }))).toBe("")
  })

  it("must be a number from 0 to 100", () => {
    expect(said(broken({ progress: () => 140 }))).toContain("progress is not a number from 0 to 100")
    expect(said(broken({ progress: () => -1 }))).toContain("progress is not a number from 0 to 100")
    expect(said(broken({ progress: () => Number.NaN }))).toContain("progress is not a number from 0 to 100")
    expect(said(broken({ progress: (() => "half") as unknown as () => number }))).toContain("progress is not a number from 0 to 100")
  })

  it("may not throw", () => {
    expect(said(broken({ progress: () => { throw new Error("boom") } }))).toContain("progress throws an error where it must work")
  })

  it("may not change once jsonb has reordered the keys of the state", () => {
    expect(said(broken({ progress: (state) => (Object.keys(state.scores)[0] === state.seats[0] ? 10 : 20) }))).toContain("progress changes once jsonb has reordered the keys")
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

describe("standings", () => {
  const standingsOf = (state: State): Standing[] => state.seats.map((id) => ({ playerId: id, score: state.scores[id]! }))
  const withStandings = (change: (standings: Standing[], viewer: string | null) => Standing[] | undefined) =>
    broken({ view: (s, v) => ({ ...dash.view(s, v), standings: change(standingsOf(s), v) }) })

  it("have nothing said about them when a game has none, or when each player is there once, in seat order, with a finite score", () => {
    expect(said(dash)).toBe("")
    expect(said(withStandings((standings) => standings))).toBe("")
  })

  it("hold each player of the table once, in seat order", () => {
    const problem = "the standings do not hold each player of the table once, in seat order"
    expect(said(withStandings((standings) => standings.slice(1)))).toContain(problem)
    expect(said(withStandings((standings) => [...standings, standings[0]!]))).toContain(problem)
    expect(said(withStandings((standings) => [...standings].reverse()))).toContain(problem)
    expect(said(withStandings((standings) => standings.map((standing) => ({ ...standing, playerId: `${standing.playerId}-x` }))))).toContain(problem)
  })

  it("have a finite score for each player", () => {
    expect(said(withStandings((standings) => standings.map((standing) => ({ ...standing, score: "3" as unknown as number }))))).toContain("a standing has a score that is not a finite number")
  })

  it("are there for every viewer, and the same for each", () => {
    expect(said(withStandings((standings, viewer) => (viewer === null ? undefined : standings)))).toContain("the view carries standings for some viewers and not for others")
    expect(said(withStandings((standings, viewer) => standings.map((standing) => ({ ...standing, score: standing.score + (viewer === standing.playerId ? 1 : 0) }))))).toContain("the standings are not the same for every viewer")
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

// The same game, now saying what happens: each roll is an event of the log. A step and an autoPlayStep come together, and what they say is held to the rules of the log.
type Rolled = { kind: "rolled"; by: string; points: number; secret?: string }

const rolled = (before: State, after: State, id: string): LogEntry<Rolled> => ({ event: { kind: "rolled", by: id, points: after.scores[id]! - before.scores[id]! } })

const logged: GameDefinition<State, Roll, View, undefined, Rolled> = {
  ...dash,
  setupStep: (args): Step<State, Rolled> => ({ state: dash.setup(args), events: [{ event: { kind: "rolled", by: args.players[0]!.id, points: 0 } }] }),
  step: (state, action): Step<State, Rolled> => {
    const next = dash.apply(state, action)
    return { state: next, events: [rolled(state, next, action.playerId)] }
  },
  autoPlayStep: (state, playerId): Step<State, Rolled> => {
    const next = dash.autoPlayFor!(state, playerId)
    return { state: next, events: [rolled(state, next, playerId)] }
  },
}

/** The logged game, with what its auto-play says changed. */
const saying = (change: (step: Step<State, Rolled>, playerId: string) => Step<State, Rolled>): AnyGameDefinition => ({
  ...logged,
  autoPlayStep: (state, playerId) => change(logged.autoPlayStep!(state, playerId), playerId),
})

const entries = (...list: unknown[]) => (step: Step<State, Rolled>) => ({ ...step, events: list as LogEntry<Rolled>[] })

describe("the log", () => {
  it("has nothing said about a game that says what happens and keeps the contract", () => {
    expect(conformanceProblems(logged, { secretsFor, errorCodes: [] })).toEqual([])
  })

  it("wants a step and an autoPlayStep together", () => {
    expect(said({ ...logged, autoPlayStep: undefined })).toContain("a step but no autoPlayStep")
    expect(said({ ...logged, step: undefined })).toContain("an autoPlayStep but no step")
  })

  it("wants autoPlayStep to play the move autoPlayFor plays", () => {
    expect(said(saying((step) => ({ ...step, state: { ...step.state, target: step.state.target + 1 } })))).toContain("autoPlayStep gives another state than autoPlayFor")
  })

  it("wants the same log each time for the same state", () => {
    let count = 0
    expect(said(saying((step, id) => ({ ...step, events: [{ event: { kind: "rolled", by: id, points: count++ } }] })))).toContain("two different logs for the same state")
  })

  it("wants the entries to be plain JSON", () => {
    expect(said(saying((step, id) => entries({ event: { kind: "rolled", by: id, points: undefined } })(step)))).toContain("the log of a step is not plain JSON")
  })

  it("wants every entry to have an event", () => {
    expect(said(saying((step) => entries({})(step)))).toContain("an entry of the log has no event")
    expect(said(saying((step) => entries({ event: "rolled" })(step)))).toContain("an entry of the log has no event")
  })

  it("wants an entry to be addressed to players of the table, and a masked version to have somebody it is addressed to", () => {
    expect(said(saying((step, id) => entries({ event: { kind: "rolled", by: id, points: 1 }, to: ["nobody"] })(step)))).toContain("addressed to somebody who is not at the table")
    expect(said(saying((step, id) => entries({ event: { kind: "rolled", by: id, points: 1 }, masked: { kind: "rolled", by: id, points: 0 } })(step)))).toContain("a masked version but nobody it is addressed to")
  })

  it("refuses a nickname in an entry: the log keeps the ids", () => {
    expect(said(saying((step) => entries({ event: { kind: "rolled", by: "Nickname 1", points: 1 } })(step)))).toContain("an entry of the log holds a nickname")
  })

  it("refuses a log that shows a viewer what they must not know, unless only the owner reads it in full", () => {
    const secretOf = (state: State, id: string) => state.secrets[state.seats.indexOf(id)]!
    const everybody = saying((step, id) => entries({ event: { kind: "rolled", by: id, points: 1, secret: secretOf(step.state, id) } })(step))
    expect(said(everybody)).toContain("the log shows what its viewer must not know")
    const owner = saying((step, id) => entries({ event: { kind: "rolled", by: id, points: 1, secret: secretOf(step.state, id) }, to: [id], masked: { kind: "rolled", by: id, points: 1 } })(step))
    expect(said(owner)).toBe("")
  })

  it("is not asked of a game that says nothing", () => {
    expect(said(dash)).toBe("")
  })
})

describe("the opening of the log", () => {
  it("wants a setupStep to come with a step", () => {
    expect(said({ ...logged, step: undefined, autoPlayStep: undefined })).toContain("a setupStep but no step")
  })

  it("wants setupStep to set up the game setup sets up", () => {
    const other: AnyGameDefinition = { ...logged, setupStep: (args) => ({ ...logged.setupStep!(args), state: { ...dash.setup(args), target: 7 } }) }
    expect(said(other)).toContain("setupStep gives another game than setup")
  })

  it("wants the same log each time for the same seed", () => {
    let count = 0
    const other: AnyGameDefinition = { ...logged, setupStep: (args) => ({ state: dash.setup(args), events: [{ event: { kind: "rolled", by: args.players[0]!.id, points: count++ } }] }) }
    expect(said(other)).toContain("setupStep gives two different logs for the same seed")
  })

  it("holds what it says to the rules of an entry, as the moves are", () => {
    const named: AnyGameDefinition = { ...logged, setupStep: (args) => ({ state: dash.setup(args), events: [{ event: { kind: "rolled", by: "Nickname 1", points: 0 } }] }) }
    expect(said(named)).toContain("an entry of the log holds a nickname")
    const leaking: AnyGameDefinition = {
      ...logged,
      setupStep: (args) => {
        const state = dash.setup(args)
        return { state, events: [{ event: { kind: "rolled", by: args.players[0]!.id, points: 0, secret: state.secrets[0] } }] }
      },
    }
    expect(said(leaking)).toContain("the log shows what its viewer must not know")
  })

  it("says which hook of the opening refuses a table where it must work", () => {
    expect(said({ ...logged, setupStep: (args) => ({ state: dash.setup({ ...args, players: [] }), events: [] }) })).toContain("setupStep")
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

// The same race with a clock: each turn lasts ten seconds, and a turn that runs out is rolled for by the clock, a system action that no client can send.
describe("the clock", () => {
  type Timeout = { type: "timeout"; playerId: string; at?: number }
  const SECONDS = 10_000
  const after = (state: State, at: number | undefined): State => ({ ...state, deadline: at === undefined ? null : at + SECONDS })
  const timed: GameDefinition<State, Roll | Timeout, View> = {
    ...dash,
    step: undefined,
    autoPlayStep: undefined,
    begin: (state, at) => after(state, at),
    apply: (state, action) => {
      if (action.type === "timeout") {
        if (!isSystemAction(action)) throw new EngineError("INVALID_ACTION")
        return after(roll(state, state.seats[state.turn]!), action.at)
      }
      if (action.type !== "roll") throw new EngineError("INVALID_ACTION")
      return after(roll(state, action.playerId), action.at)
    },
    autoPlayFor: (state, playerId, at) => {
      if (!waiting(state).includes(playerId)) throw new EngineError("NOT_WAITING")
      return after(roll(state, playerId), at)
    },
    nextDeadline: (state) => (state.over || state.deadline === null || state.deadline === undefined ? null : { at: state.deadline, action: systemAction("timeout", state.deadline) as Timeout }),
  }
  const clocked = (patch: Partial<GameDefinition<State, Roll | Timeout, View>>) => ({ ...timed, ...patch }) as unknown as AnyGameDefinition

  it("has nothing said about a game that keeps the contract, played to its end by its players and by its clock", () => {
    expect(conformanceProblems(timed as unknown as AnyGameDefinition, { secretsFor, errorCodes: [], seeds: 4 })).toEqual([])
  })

  it("is not asked of a game that has none", () => {
    expect(said(dash)).toBe("")
  })

  it("must name a time that is a finite number of milliseconds", () => {
    expect(said(clocked({ nextDeadline: (state) => (state.over || state.deadline == null ? null : { at: Number.NaN, action: systemAction("timeout", 0) as Timeout }) }))).toContain("the time of a deadline is not a finite number")
  })

  it("must name an action that the clock plays, not one of a seat", () => {
    expect(said(clocked({ nextDeadline: (state) => (state.over || state.deadline == null ? null : { at: state.deadline, action: { type: "timeout", playerId: state.seats[0]! } }) }))).toContain("the action of a deadline is not a system action")
  })

  it("must name an action that no client may send", () => {
    expect(said(clocked({ clientActions: ["roll", "timeout"] }))).toContain("the action of a deadline is one a client may send")
  })

  it("must have none once the game is over", () => {
    expect(said(clocked({ nextDeadline: (state) => ({ at: state.deadline ?? 0, action: systemAction("timeout", state.deadline ?? 0) as Timeout }) }))).toContain("nextDeadline names a deadline once the game is over")
  })

  it("must move the game on when its action is played", () => {
    expect(said(clocked({ apply: (state, action) => (action.type === "timeout" ? state : timed.apply(state, action)) }))).toContain("the action of a deadline changes nothing")
  })

  it("must not be earlier than the one just played", () => {
    expect(said(clocked({ apply: (state, action) => (action.type === "timeout" ? { ...timed.apply(state, action), deadline: (action.at ?? 0) - 1 } : timed.apply(state, action)) }))).toContain("the next deadline is earlier than the one just played")
  })

  it("must come from the state alone, the same on every call", () => {
    let calls = 0
    expect(said(clocked({ nextDeadline: (state) => (state.over || state.deadline == null ? null : { at: state.deadline + calls++, action: systemAction("timeout", state.deadline) as Timeout }) }))).toContain("the deadline of a game changes")
  })

  it("must leave a game that goes live twice as it is once, at the later time", () => {
    expect(said(clocked({ begin: (state, at) => ({ ...state, deadline: (state.deadline ?? 0) + at + SECONDS }) }))).toContain("begin is not harmless to call again")
  })

  it("must refuse a system action from a seat", () => {
    expect(() => timed.apply(timed.setup({ players: [{ id: "a", nickname: "A" }, { id: "b", nickname: "B" }], options: {}, seed: 1 }), { type: "timeout", playerId: "a" })).toThrow(EngineError)
  })
})
