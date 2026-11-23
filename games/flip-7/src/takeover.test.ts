import { describe, expect, it } from "vitest"
import { GAME, waitingPlayers, type Action, type Flip7Event, type LogEntry, type State } from "@flip-7/engine"
import { presentPlayers } from "@pbgo/core/server/takeover"
import { iso, SECOND, takeoverRig } from "@pbgo/core/server/takeover-rig"

/**
 * Acceptance test of the takeover of absent players (engine contract v2), on Flip 7.
 *
 * Three players sit at a table. Two of them never come back: the third one plays for them, vote after vote, and finishes the game alone.
 *
 * Nothing here needs Supabase. The engine and the voting rules of core are the real ones, and the table, the clock, `jsonb` and the glue of
 * `POST /api/<slug>/games/<code>/takeover` are the rig of core (`takeoverRig`). Adapt this file with the engine: `humanMove` is the only part that knows Flip 7.
 */

// Ids of different lengths on purpose: the seat order is not the order `jsonb` gives the keys back in
const PLAYERS = [
  { id: "alice", nickname: "Alice" },
  { id: "bob", nickname: "Bob" },
  { id: "charlie", nickname: "Charlie" },
]

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

const rig = takeoverRig({ game: GAME, players: PLAYERS, humanMove })
const { takeover, wait, turnTimeout } = rig
const finishAlone = (table: ReturnType<typeof rig.open>) => rig.finishAlone(table, "charlie")
/** A table that has just started: Alice and Bob left two minutes ago, Charlie is here. A target of 50 keeps the game short. */
const openTable = () => rig.open({ present: ["charlie"], options: { targetScore: 50 } })

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
