import { describe, expect, it } from "vitest"
import type { AnyGameDefinition } from "./contract"
import { EngineError } from "./errors"
import { canPlayFor, currentPlayer, playFor, playOn, waitingPlayers, type TurnHooks } from "./turns"

type S = { over: boolean; waiting: string[]; active: string | null; log: string[] }

const state = (patch: Partial<S> = {}): S => ({ over: false, waiting: ["a"], active: "a", log: [], ...patch })

/** A definition made of the turn hooks only, which is all the helpers read. */
const hooks = (extra: Partial<TurnHooks<S>> = {}): TurnHooks<S> => ({ isOver: (s) => s.over, ...extra })

const noop = (s: S) => s

describe("waitingPlayers", () => {
  it("falls back to the active player when the game has no waitingFor", () => {
    const game = hooks({ activePlayer: (s) => s.active })
    expect(waitingPlayers(game, state({ active: "b" }))).toEqual(["b"])
  })

  it("is empty when the legacy active player is null or the game defines nothing", () => {
    expect(waitingPlayers(hooks({ activePlayer: (s) => s.active }), state({ active: null }))).toEqual([])
    expect(waitingPlayers(hooks(), state())).toEqual([])
  })

  it("reads waitingFor first and keeps its order", () => {
    const game = hooks({ waitingFor: (s) => s.waiting, activePlayer: () => "ignored" })
    expect(waitingPlayers(game, state({ waiting: ["c", "a", "b"] }))).toEqual(["c", "a", "b"])
  })

  it("is empty once the game is over, whatever the hooks say", () => {
    const game = hooks({ waitingFor: (s) => s.waiting, activePlayer: (s) => s.active })
    expect(waitingPlayers(game, state({ over: true }))).toEqual([])
    expect(waitingPlayers(hooks({ activePlayer: (s) => s.active }), state({ over: true }))).toEqual([])
  })

  it("removes duplicates and keeps the first occurrence", () => {
    const game = hooks({ waitingFor: (s) => s.waiting })
    expect(waitingPlayers(game, state({ waiting: ["a", "b", "a", "c", "b"] }))).toEqual(["a", "b", "c"])
  })

  it("returns a new array, not the one of the engine", () => {
    const waiting = ["a", "b"]
    const result = waitingPlayers(hooks({ waitingFor: () => waiting }), state())
    expect(result).toEqual(waiting)
    expect(result).not.toBe(waiting)
  })
})

describe("currentPlayer", () => {
  it("uses the legacy activePlayer when the game has one", () => {
    const game = hooks({ activePlayer: (s) => s.active, waitingFor: (s) => s.waiting })
    expect(currentPlayer(game, state({ active: "b", waiting: ["a", "b"] }))).toBe("b")
  })

  it("is the first waiting player without activePlayer", () => {
    const game = hooks({ waitingFor: (s) => s.waiting })
    expect(currentPlayer(game, state({ waiting: ["c", "a"] }))).toBe("c")
  })

  it("is null when nobody is waiting or the game is over", () => {
    expect(currentPlayer(hooks({ waitingFor: (s) => s.waiting }), state({ waiting: [] }))).toBeNull()
    expect(currentPlayer(hooks({ activePlayer: (s) => s.active }), state({ active: null }))).toBeNull()
    expect(currentPlayer(hooks({ activePlayer: (s) => s.active }), state({ over: true }))).toBeNull()
    expect(currentPlayer(hooks(), state())).toBeNull()
  })
})

describe("canPlayFor", () => {
  const knows = { waitingFor: (s: S) => s.waiting }
  const legacyKnows = { activePlayer: (s: S) => s.active }
  const plays = { autoPlayFor: noop }

  it("needs to know who waits AND a way to play for them", () => {
    expect(canPlayFor(hooks())).toBe(false)
    expect(canPlayFor(hooks(knows))).toBe(false)
    expect(canPlayFor(hooks(plays))).toBe(false)
    expect(canPlayFor(hooks({ ...knows, ...plays }))).toBe(true)
  })

  it("accepts the legacy hooks, in any combination", () => {
    expect(canPlayFor(hooks({ ...legacyKnows, autoPlay: noop }))).toBe(true)
    expect(canPlayFor(hooks({ ...legacyKnows, debug: { turn: noop } }))).toBe(true)
    expect(canPlayFor(hooks({ ...knows, autoPlay: noop }))).toBe(true)
    expect(canPlayFor(hooks({ ...legacyKnows, ...plays }))).toBe(true)
    expect(canPlayFor(hooks({ ...legacyKnows, debug: { over: noop } }))).toBe(false)
  })
})

describe("playFor", () => {
  it("uses autoPlayFor with the player", () => {
    const calls: string[] = []
    const game = hooks({
      waitingFor: (s) => s.waiting,
      autoPlayFor: (s, id) => {
        calls.push(id)
        return { ...s, waiting: s.waiting.filter((p) => p !== id) }
      },
    })
    const next = playFor(game, state({ waiting: ["a", "b", "c"] }), "b")
    expect(calls).toEqual(["b"])
    expect(next.waiting).toEqual(["a", "c"])
  })

  it("prefers autoPlayFor to the legacy hooks", () => {
    const game = hooks({
      activePlayer: (s) => s.active,
      autoPlayFor: (s) => ({ ...s, log: [...s.log, "new"] }),
      autoPlay: (s) => ({ ...s, log: [...s.log, "legacy"] }),
    })
    expect(playFor(game, state(), "a").log).toEqual(["new"])
  })

  it("falls back to autoPlay, then debug.turn, for the only waiting player", () => {
    const withAutoPlay = hooks({
      activePlayer: (s) => s.active,
      autoPlay: (s) => ({ ...s, log: ["autoPlay"] }),
      debug: { turn: (s) => ({ ...s, log: ["turn"] }) },
    })
    expect(playFor(withAutoPlay, state(), "a").log).toEqual(["autoPlay"])
    const withTurn = hooks({ activePlayer: (s) => s.active, debug: { turn: (s) => ({ ...s, log: ["turn"] }) } })
    expect(playFor(withTurn, state(), "a").log).toEqual(["turn"])
  })

  it("does not use a legacy hook when several players are waiting", () => {
    const game = hooks({ waitingFor: (s) => s.waiting, autoPlay: noop })
    expect(() => playFor(game, state({ waiting: ["a", "b"] }), "a")).toThrow(expect.objectContaining({ code: "AUTOPLAY_UNSUPPORTED" }))
  })

  it("throws AUTOPLAY_UNSUPPORTED when the game cannot play for anybody", () => {
    const game = hooks({ activePlayer: (s) => s.active })
    expect(() => playFor(game, state(), "a")).toThrow(EngineError)
    expect(() => playFor(game, state(), "a")).toThrow(expect.objectContaining({ code: "AUTOPLAY_UNSUPPORTED" }))
  })

  it("throws NOT_WAITING for a player who is not waiting, before reaching any hook", () => {
    let called = false
    const game = hooks({
      waitingFor: (s) => s.waiting,
      autoPlayFor: (s) => {
        called = true
        return s
      },
    })
    expect(() => playFor(game, state({ waiting: ["a"] }), "b")).toThrow(expect.objectContaining({ code: "NOT_WAITING" }))
    expect(() => playFor(game, state({ over: true }), "a")).toThrow(expect.objectContaining({ code: "NOT_WAITING" }))
    expect(called).toBe(false)
  })
})

describe("playOn", () => {
  /** A countdown: each play removes the first waiting player, the game ends when nobody is left. */
  const countdown: TurnHooks<S> = {
    isOver: (s) => s.waiting.length === 0,
    waitingFor: (s) => s.waiting,
    autoPlayFor: (s, id) => ({ ...s, waiting: s.waiting.filter((p) => p !== id), log: [...s.log, id] }),
  }

  it("plays for the first waiting player until the game is over", () => {
    const end = playOn(countdown, state({ waiting: ["a", "b", "c"] }))
    expect(end.waiting).toEqual([])
    expect(end.log).toEqual(["a", "b", "c"])
  })

  it("returns the state untouched when the game is already over", () => {
    const start = state({ over: true })
    expect(playOn(hooks({ waitingFor: (s) => s.waiting, autoPlayFor: noop }), start)).toBe(start)
  })

  it("stops after maxSteps when the game never ends", () => {
    let plays = 0
    const forever: TurnHooks<S> = {
      isOver: () => false,
      waitingFor: (s) => s.waiting,
      autoPlayFor: (s) => {
        plays++
        return s
      },
    }
    playOn(forever, state(), 25)
    expect(plays).toBe(25)
  })

  it("stops when nobody is waiting although the game is not over", () => {
    const idle: TurnHooks<S> = { isOver: () => false, waitingFor: () => [], autoPlayFor: noop }
    const start = state()
    expect(playOn(idle, start)).toBe(start)
  })
})

describe("with a full game definition", () => {
  it("accepts any game as the helpers' parameter", () => {
    const game: AnyGameDefinition = {
      id: "t",
      name: "T",
      minPlayers: 1,
      maxPlayers: 2,
      options: {},
      clientActions: [],
      setup: () => state(),
      apply: (s: S) => s,
      view: (s: S) => s,
      isOver: (s: S) => s.over,
      waitingFor: (s: S) => s.waiting,
      autoPlayFor: (s: S) => s,
    }
    expect(waitingPlayers(game, state({ waiting: ["z"] }))).toEqual(["z"])
    expect(canPlayFor(game)).toBe(true)
  })
})
