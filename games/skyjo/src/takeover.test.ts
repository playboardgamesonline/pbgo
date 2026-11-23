import { describe, expect, it } from "vitest"
import { GAME, waitingPlayers, type Action, type SkyjoEvent, type LogEntry, type State } from "@skyjo/engine"
import { presentPlayers } from "@pbgo/core/server/takeover"
import { iso, SECOND, takeoverRig } from "@pbgo/core/server/takeover-rig"

/**
 * Acceptance test of the takeover of absent players (engine contract v2), on Skyjo.
 *
 * Three players sit at a table. Two of them never come back: the third one plays for them, vote after vote, and finishes the game alone.
 *
 * Nothing here needs Supabase. The engine and the voting rules of core are the real ones, and the table, the clock, `jsonb` and the glue of `POST /api/<slug>/games/<code>/takeover` are the rig of core (`takeoverRig`). `humanMove` is the only part that knows Skyjo.
 */

// Ids of different lengths on purpose: the seat order is not the order `jsonb` gives the keys back in
const PLAYERS = [
  { id: "alice", nickname: "Alice" },
  { id: "bob", nickname: "Bob" },
  { id: "charlie", nickname: "Charlie" },
]

/**
 * What a human does on this board when the game waits for them: turns their first two cards over, then on their turn draws, places the card on the first face-down card of their grid (or flips one, when they have drawn and thrown it away), and deals the
 * next round when it is theirs to deal. (Skyjo waits for every player who still has to turn cards over, then for one player at a time.)
 */
function humanMove(state: State, playerId: string): Action {
  const { phase, players } = GAME.view(state, playerId)
  const mine = players.find((player) => player.id === playerId)!
  const hidden = mine.cells.findIndex((cell) => cell !== null && !cell.up)
  switch (phase.kind) {
    case "reveal":
      return { type: "reveal", playerId, position: hidden }
    case "choose":
      return { type: "draw", playerId }
    case "place":
      return { type: "place", playerId, position: hidden >= 0 ? hidden : mine.cells.findIndex((cell) => cell !== null) }
    case "flip":
      return { type: "flip", playerId, position: hidden }
    case "between":
      return { type: "deal", playerId }
    case "over":
      throw new Error("the game is over: nobody is waited for")
  }
}

const rig = takeoverRig({ game: GAME, players: PLAYERS, humanMove })
const { act, takeover, wait, turnTimeout } = rig
const finishAlone = (table: ReturnType<typeof rig.open>) => rig.finishAlone(table, "charlie")
/** A table that has just started: Alice and Bob left two minutes ago, Charlie is here. */
const openTable = () => rig.open({ present: ["charlie"] })

const revealsBy = (log: LogEntry<SkyjoEvent>[], playerId: string) => log.filter(({ event }) => event.kind === "reveal" && event.by === playerId).length

describe("absent players", () => {
  it("lets the third player finish a game where the other two never came back", () => {
    const table = openTable()
    expect(presentPlayers(PLAYERS, table.seen, table.now)).toEqual(["charlie"])
    // The opening is a simultaneous step: the game waits for all three, and Charlie's vote is for the two who are away
    expect(waitingPlayers(GAME, table.state)).toHaveLength(3)

    const { table: end, takeovers } = finishAlone(table)
    expect(GAME.isOver(end.state)).toBe(true)
    // Round after round, the absent players were played for: they turned their opening cards over, played whole turns and dealt when it was their turn to
    expect(takeovers.alice).toBeGreaterThan(1)
    expect(takeovers.bob).toBeGreaterThan(1)
    expect(revealsBy(end.log, "alice")).toBeGreaterThan(0)
    expect(revealsBy(end.log, "bob")).toBeGreaterThan(0)
    // ...to the end of the game: everybody has a result and somebody won
    const results = GAME.view(end.state, "charlie").results
    expect(results?.players).toHaveLength(3)
    expect(results?.winners.length).toBeGreaterThan(0)
  })

  it("needs the vote of every present player other than the one played for", () => {
    // Everybody is here this time, and the round is open: a player the game waits for is played for once the two others have voted
    let start = openTable()
    for (const id of ["alice", "bob", "charlie"]) start = act(start, id)
    for (const id of ["alice", "bob", "charlie"]) start = waitingPlayers(GAME, start.state).includes(id) ? act(start, id) : start
    const [target] = waitingPlayers(GAME, start.state)
    expect(waitingPlayers(GAME, start.state)).toHaveLength(1)
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
