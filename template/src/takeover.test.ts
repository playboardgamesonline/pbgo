import { describe, expect, it } from "vitest"
import { GAME, playFor, waitingPlayers, type Action, type DemoOptions, type State } from "@template/engine"
import { castVotes, isStalled, presentPlayers } from "@pbgo/core/server/takeover"

/**
 * Acceptance test of the takeover of absent players (engine contract v2), on the demo game.
 *
 * Three players sit at a table with the simultaneous step on (the secret bids at the start of each round). Two of them never come
 * back: the third one plays for them, vote after vote, and finishes the game alone.
 *
 * Nothing here needs Supabase. The engine (`GAME`, `waitingPlayers`, `playFor`) and the voting rules of core (`castVotes`,
 * `presentPlayers`, `isStalled`) are the real ones; the table is a plain object, and `takeover()` is the glue of
 * `POST /api/<slug>/games/<code>/takeover`. Adapt this file with the engine: `humanMove` is the only part that knows the demo game.
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

/** A table that has just started: Alice and Bob left two minutes ago, Charlie is here. */
function openTable(options: Partial<DemoOptions>, seed = 11): Table {
  return {
    state: jsonb(GAME.setup({ players: PLAYERS, options, seed })),
    votes: [],
    seen: { alice: iso(START - 2 * MINUTE), bob: iso(START - 2 * MINUTE), charlie: iso(START) },
    updatedAt: iso(START),
    now: START,
  }
}

const wait = (table: Table, ms: number): Table => ({ ...table, now: table.now + ms })

/** What a human does on this board when the game waits for them: announces a number of tricks, or plays their first card. */
function humanMove(state: State, playerId: string): Action {
  const view = GAME.view(state, playerId)
  if (view.phase === "bidding") return { type: "bid", playerId, amount: 1 }
  return { type: "playCard", playerId, cardId: view.me!.hand[0]!.id }
}

/** A player's own move (`POST .../action`): the server writes it and notes that the player is here. The votes of the previous state stay, and are ignored. */
function act(table: Table, playerId: string): Table {
  const state = jsonb(GAME.apply(table.state, humanMove(table.state, playerId)))
  return { ...table, state, updatedAt: iso(table.now), seen: { ...table.seen, [playerId]: iso(table.now) } }
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
  for (const target of play) {
    if (GAME.isOver(state)) break
    if (waitingPlayers(GAME, state).includes(target)) state = playFor(GAME, state, target)
  }
  return { table: { ...table, state: jsonb(state), votes: [], seen, updatedAt: iso(table.now) }, play }
}

/**
 * Charlie, the only one left, plays to the end of the game: his own move when the game waits for him, otherwise he lets the delay pass
 * and votes for everyone the game waits for. Tells how many times each absent player was played for.
 */
function finishAlone(start: Table): { table: Table; takeovers: Record<string, number> } {
  let table = start
  const takeovers: Record<string, number> = {}
  for (let step = 0; !GAME.isOver(table.state); step++) {
    if (step >= 500) throw new Error("the game does not end")
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

const cardsPlayedBy = (state: State, playerId: string) => state.log.filter((e) => e.type === "cardPlayed" && e.playerId === playerId).length

describe("absent players", () => {
  it("lets the third player finish a game where the other two never came back", () => {
    let table = openTable({ bids: true })
    expect(presentPlayers(PLAYERS, table.seen, table.now)).toEqual(["charlie"])
    expect(table.state.phase).toBe("bidding")
    expect(waitingPlayers(GAME, table.state)).toEqual(["alice", "bob", "charlie"])

    // The simultaneous step: Charlie bids, the game now waits for the other two
    table = act(table, "charlie")
    expect(waitingPlayers(GAME, table.state)).toEqual(["alice", "bob"])

    // Nobody moves for a whole delay. Charlie is the only present member, so his vote for both is enough: they bid in the same write
    const { table: playing, play } = takeover(wait(table, TURN_TIMEOUT * SECOND), "charlie")
    expect(play).toEqual(["alice", "bob"])
    expect(playing.state.phase).toBe("playing")
    expect(Object.values(playing.state.bids).every((amount) => amount !== null)).toBe(true)
    expect(playing.votes).toEqual([])

    // Then the turns, a round after another, until the end of the game
    const { table: end, takeovers } = finishAlone(playing)
    const { rounds, handSize } = end.state.options
    expect(end.state.phase).toBe("over")
    expect(end.state.players.every((player) => player.pointsPerRound.length === rounds)).toBe(true)
    // everybody played every card of every round, the absent players through the takeover
    expect(PLAYERS.map((player) => cardsPlayedBy(end.state, player.id))).toEqual([rounds * handSize, rounds * handSize, rounds * handSize])
    // ...and bid in every round after the first one the same way
    expect(takeovers).toEqual({ alice: rounds * handSize + rounds - 1, bob: rounds * handSize + rounds - 1 })
    const results = GAME.view(end.state, "charlie").results
    expect(results?.players).toHaveLength(3)
    expect(results?.winners.length).toBeGreaterThan(0)
  })

  it("does the same on plain turns, without the simultaneous step", () => {
    const table = openTable({ bids: false })
    expect(table.state.phase).toBe("playing")
    const { table: end, takeovers } = finishAlone(table)
    const { rounds, handSize } = end.state.options
    expect(end.state.phase).toBe("over")
    expect(takeovers).toEqual({ alice: rounds * handSize, bob: rounds * handSize })
  })

  it("plays for one absent player of the simultaneous step at a time when asked to", () => {
    const table = act(openTable({ bids: true }), "charlie")
    const first = takeover(wait(table, TURN_TIMEOUT * SECOND), "charlie", ["alice"])
    expect(first.play).toEqual(["alice"])
    expect(first.table.state.phase).toBe("bidding")
    expect(waitingPlayers(GAME, first.table.state)).toEqual(["bob"])

    const second = takeover(wait(first.table, TURN_TIMEOUT * SECOND), "charlie", ["bob"])
    expect(second.play).toEqual(["bob"])
    expect(second.table.state.phase).toBe("playing")
  })

  it("needs the vote of every present player other than the one played for", () => {
    // Everybody is here this time: the player the game waits for is played for once the two others have voted
    const start = openTable({ bids: false })
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
