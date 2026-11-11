import { describe, expect, it } from "vitest"
import { GAME, playStepFor, setupOf, stepOf, waitingPlayers, type Action, type Flip7Event, type LogEntry, type State } from "@flip-7/engine"
import { castVotes, isStalled, presentPlayers } from "@pbgo/core/server/takeover"

/**
 * Acceptance test of the takeover of absent players (engine contract v2), on Flip 7.
 *
 * Three players sit at a table. Two of them never come back: the third one plays for them, vote after vote, and finishes the game alone.
 *
 * Nothing here needs Supabase. The engine (`GAME`, `waitingPlayers`, `playStepFor`) and the voting rules of core (`castVotes`, `presentPlayers`, `isStalled`) are the real ones; the table is a plain object, and `takeover()` is the glue of
 * `POST /api/<slug>/games/<code>/takeover`. Adapt this file with the engine: `humanMove` is the only part that knows Flip 7.
 */

const SECOND = 1000
const MINUTE = 60 * SECOND
const START = Date.parse("2026-10-12T10:00:00.000Z")
/** Admin › Mechanics: a table that has not moved for this long can be taken over (60 s by default) */
const TURN_TIMEOUT = 60

// Ids of different lengths on purpose: the seat order is not the order `jsonb` gives the keys back in
const PLAYERS = [
  { id: "alice", nickname: "Alice" },
  { id: "bob", nickname: "Bob" },
  { id: "charlie", nickname: "Charlie" },
]

/** What the server keeps of a table (the columns of `games`), and the clock of the test */
type Table = {
  state: State
  /** The log of the table (`game_log`): what each move said, in order. The state keeps none */
  log: LogEntry<Flip7Event>[]
  /** `takeover_votes` */
  votes: string[]
  /** `seen`: when the server last saw each player */
  seen: Record<string, string>
  /** `updated_at`: the last write */
  updatedAt: string
  now: number
}

const iso = (time: number) => new Date(time).toISOString()

/** The way Postgres `jsonb` gives a value back: the keys of every object shortest first, then alphabetically, whatever order they were written in. */
function jsonb<T>(value: T): T {
  const sorted = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sorted)
    if (!v || typeof v !== "object") return v
    const keys = Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(keys.map((key) => [key, sorted((v as Record<string, unknown>)[key])]))
  }
  return sorted(JSON.parse(JSON.stringify(value))) as T
}

/** Stamp of a state for the votes. The server uses `stateFingerprint` (same hash), which can't be imported here: it pulls Supabase in. */
function stamp(state: State): string {
  const text = JSON.stringify(state)
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** A table that has just started: Alice and Bob left two minutes ago, Charlie is here. A target of 50 keeps the game short. */
function openTable(options: Record<string, number> = { targetScore: 50 }, seed = 11): Table {
  const opened = setupOf(GAME, { players: PLAYERS, options, seed })
  return {
    state: jsonb(opened.state),
    log: [...opened.events],
    votes: [],
    seen: { alice: iso(START - 2 * MINUTE), bob: iso(START - 2 * MINUTE), charlie: iso(START) },
    updatedAt: iso(START),
    now: START,
  }
}

const wait = (table: Table, ms: number): Table => ({ ...table, now: table.now + ms })

/**
 * What a human does on this board when the game waits for them: deals the next round, hits until they have two cards in front of them and then stays, and gives the action card they hold to the first player who can get it.
 * (Flip 7 waits for one player at a time, whatever the step.)
 */
function humanMove(state: State, playerId: string): Action {
  const { phase, players } = GAME.view(state, playerId)
  switch (phase.kind) {
    case "between":
      return { type: "deal", playerId }
    case "target":
      return { type: "target", playerId, target: phase.targets[0]! }
    case "turn":
      return { type: players.find((player) => player.id === playerId)!.cards.length < 2 || !phase.canStay ? "hit" : "stay", playerId }
    case "over":
      throw new Error("the game is over: nobody is waited for")
  }
}

/** A player's own move (`POST .../action`): the server writes it and notes that the player is here. The votes of the previous state stay, and are ignored. */
function act(table: Table, playerId: string): Table {
  const played = stepOf(GAME, table.state, humanMove(table.state, playerId))
  return { ...table, state: jsonb(played.state), log: [...table.log, ...played.events], updatedAt: iso(table.now), seen: { ...table.seen, [playerId]: iso(table.now) } }
}

/**
 * `POST /api/<slug>/games/<code>/takeover` without HTTP: `voter` votes for `targets` (by default every player the game waits for),
 * and the players whose vote is complete are played for, in the same write. Same steps as `packages/core/routes/api/games/[code]/takeover/route.ts`.
 */
function takeover(table: Table, voter: string, targets?: string[]): { table: Table; play: string[] } {
  if (!isStalled(table.updatedAt, table.now, TURN_TIMEOUT)) throw new Error("NOT_STALLED")
  const waiting = waitingPlayers(GAME, table.state)
  const { entries, play } = castVotes({
    players: PLAYERS,
    waiting,
    present: presentPlayers(PLAYERS, table.seen, table.now),
    entries: table.votes,
    fingerprint: stamp(table.state),
    voter,
    targets: targets ?? waiting,
  })
  const seen = { ...table.seen, [voter]: iso(table.now) }
  if (!play.length) return { table: { ...table, votes: entries, seen }, play }
  let state = table.state
  const log = [...table.log]
  for (const target of play) {
    if (GAME.isOver(state)) break
    if (waitingPlayers(GAME, state).includes(target)) {
      const played = playStepFor(GAME, state, target)
      state = played.state
      log.push(...played.events)
    }
  }
  return { table: { ...table, state: jsonb(state), log, votes: [], seen, updatedAt: iso(table.now) }, play }
}

/**
 * Charlie, the only one left, plays to the end of the game: his own move when the game waits for him, otherwise he lets the delay pass
 * and votes for everyone the game waits for. Tells how many times each absent player was played for.
 */
function finishAlone(start: Table): { table: Table; takeovers: Record<string, number> } {
  let table = start
  const takeovers: Record<string, number> = {}
  for (let step = 0; !GAME.isOver(table.state); step++) {
    if (step >= 1000) throw new Error("the game does not end")
    if (waitingPlayers(GAME, table.state).includes("charlie")) {
      table = act(table, "charlie")
      continue
    }
    const result = takeover(wait(table, TURN_TIMEOUT * SECOND), "charlie")
    table = result.table
    for (const target of result.play) takeovers[target] = (takeovers[target] ?? 0) + 1
  }
  return { table, takeovers }
}

const staysBy = (log: LogEntry<Flip7Event>[], playerId: string) => log.filter(({ event }) => event.kind === "stay" && event.by === playerId).length

describe("absent players", () => {
  it("lets the third player finish a game where the other two never came back", () => {
    const table = openTable()
    expect(presentPlayers(PLAYERS, table.seen, table.now)).toEqual(["charlie"])
    // One player at a time, whatever the step: the vote of Charlie is for that one player
    expect(waitingPlayers(GAME, table.state)).toHaveLength(1)

    const { table: end, takeovers } = finishAlone(table)
    expect(GAME.isOver(end.state)).toBe(true)
    // Round after round, the absent players were played for: they stayed (or hit when they had nothing in front of them), gave the action cards they held and dealt when it was their turn to
    expect(takeovers.alice).toBeGreaterThan(1)
    expect(takeovers.bob).toBeGreaterThan(1)
    expect(staysBy(end.log, "alice")).toBeGreaterThan(0)
    expect(staysBy(end.log, "bob")).toBeGreaterThan(0)
    // ...to the end of the game: everybody has a result and somebody won
    const results = GAME.view(end.state, "charlie").results
    expect(results?.players).toHaveLength(3)
    expect(results?.winners.length).toBeGreaterThan(0)
  })

  it("needs the vote of every present player other than the one played for", () => {
    // Everybody is here this time: the player the game waits for is played for once the two others have voted
    const start = openTable()
    const [target] = waitingPlayers(GAME, start.state)
    const [first, second] = PLAYERS.map((player) => player.id).filter((id) => id !== target)
    const seen = Object.fromEntries(PLAYERS.map((player) => [player.id, iso(start.now)]))
    const quiet = wait({ ...start, seen }, TURN_TIMEOUT * SECOND)

    const one = takeover(quiet, first!)
    expect(one.play).toEqual([])
    expect(waitingPlayers(GAME, one.table.state)).toEqual([target])
    expect(one.table.votes).toHaveLength(1)

    const two = takeover(one.table, second!)
    expect(two.play).toEqual([target])
    expect(waitingPlayers(GAME, two.table.state)).not.toContain(target)
  })
})
