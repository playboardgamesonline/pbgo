import { describe, expect, it } from "vitest"
import { GAME, waitingPlayers, type Action, type DemoOptions, type GameEvent, type LogEntry, type State } from "@template/engine"
import { presentPlayers } from "@pbgo/core/server/takeover"
import { iso, SECOND, takeoverRig } from "@pbgo/core/server/takeover-rig"

/**
 * Acceptance test of the takeover of absent players (engine contract v2), on the demo game.
 *
 * Three players sit at a table with the simultaneous step on (the secret bids at the start of each round). Two of them never come
 * back: the third one plays for them, vote after vote, and finishes the game alone.
 *
 * Nothing here needs Supabase. The engine and the voting rules of core are the real ones, and the table, the clock, `jsonb` and the glue of
 * `POST /api/<slug>/games/<code>/takeover` are the rig of core (`takeoverRig`). Adapt this file with the engine: `humanMove` is the only part that knows the demo game.
 */

// Ids of different lengths on purpose: the seat order is not the order `jsonb` gives the keys back in
const PLAYERS = [
  { id: "alice", nickname: "Alice" },
  { id: "bob", nickname: "Bob" },
  { id: "charlie", nickname: "Charlie" },
]

/** What a human does on this board when the game waits for them: announces a number of tricks, or plays their first card. */
function humanMove(state: State, playerId: string): Action {
  const view = GAME.view(state, playerId)
  if (view.phase === "bidding") return { type: "bid", playerId, amount: 1 }
  return { type: "playCard", playerId, cardId: view.me!.hand[0]!.id }
}

const rig = takeoverRig({ game: GAME, players: PLAYERS, humanMove })
const { act, takeover, wait, turnTimeout } = rig
const finishAlone = (table: ReturnType<typeof rig.open>) => rig.finishAlone(table, "charlie")
/** A table that has just started: Alice and Bob left two minutes ago, Charlie is here. */
const openTable = (options: Partial<DemoOptions>) => rig.open({ present: ["charlie"], options })

const cardsPlayedBy = (log: LogEntry<GameEvent>[], playerId: string) => log.filter(({ event }) => event.type === "cardPlayed" && event.playerId === playerId).length

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
    const { table: playing, play } = takeover(wait(table, turnTimeout * SECOND), "charlie")
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
    expect(PLAYERS.map((player) => cardsPlayedBy(end.log, player.id))).toEqual([rounds * handSize, rounds * handSize, rounds * handSize])
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
    const first = takeover(wait(table, turnTimeout * SECOND), "charlie", ["alice"])
    expect(first.play).toEqual(["alice"])
    expect(first.table.state.phase).toBe("bidding")
    expect(waitingPlayers(GAME, first.table.state)).toEqual(["bob"])

    const second = takeover(wait(first.table, turnTimeout * SECOND), "charlie", ["bob"])
    expect(second.play).toEqual(["bob"])
    expect(second.table.state.phase).toBe("playing")
  })

  it("needs the vote of every present player other than the one played for", () => {
    // Everybody is here this time: the player the game waits for is played for once the two others have voted
    const start = openTable({ bids: false })
    const [target] = waitingPlayers(GAME, start.state)
    const [first, second] = PLAYERS.map((player) => player.id).filter((id) => id !== target)
    const seen = Object.fromEntries(PLAYERS.map((player) => [player.id, iso(start.now)]))
    const quiet = wait({ ...start, seen }, turnTimeout * SECOND)

    const one = takeover(quiet, first!)
    expect(one.play).toEqual([])
    expect(waitingPlayers(GAME, one.table.state)).toEqual([target])
    expect(one.table.votes).toHaveLength(1)

    const two = takeover(one.table, second!)
    expect(two.play).toEqual([target])
    expect(waitingPlayers(GAME, two.table.state)).not.toContain(target)
  })
})
