import { describe, expect, it } from "vitest"
import { type Action, type CourtisansEvent, GAME, type LogEntry, type State, waitingPlayers } from "@courtisans/engine"
import { presentPlayers } from "@pbgo/core/server/takeover"
import { iso, SECOND, takeoverRig } from "@pbgo/core/server/takeover-rig"

/**
 * Acceptance test of the takeover of absent players (engine contract v2), on Courtisans.
 *
 * Three players sit at a table. Two of them never come back: the third one plays for them, vote after vote, and finishes the game alone. The opening is a simultaneous step (everybody reads their missions), then
 * the banquet goes turn by turn.
 *
 * Nothing here needs Supabase. The engine and the voting rules of core are the real ones, and the table, the clock, `jsonb` and the glue of `POST /api/<slug>/games/<code>/takeover` are the rig of core (`takeoverRig`).
 * Adapt this file with the engine: `humanMove` is the only part that knows Courtisans.
 */

// Ids of different lengths on purpose: the seat order is not the order `jsonb` gives the keys back in
const PLAYERS = [
  { id: "alice", nickname: "Alice" },
  { id: "bob", nickname: "Bob" },
  { id: "charlie", nickname: "Charlie" },
]

/** What a human does on this board when the game waits for them: reads their missions, then plays the first card of their hand in the first zone that is still free. */
function humanMove(state: State, playerId: string): Action {
  const view = GAME.view(state, playerId)
  if (view.phase === "missions") return { type: "readMissions", playerId }
  const zone = view.availableZones[0]!
  const other = view.players.find((player) => player.id !== playerId)!.id
  const target = zone === "table" ? ({ zone: "table", level: "up" } as const) : ({ zone: "domain", playerId: zone === "domain" ? playerId : other } as const)
  return { type: "playCard", playerId, cardId: view.me!.hand[0]!.id, target }
}

const rig = takeoverRig({ game: GAME, players: PLAYERS, humanMove })
const { act, takeover, wait, turnTimeout } = rig
const finishAlone = (table: ReturnType<typeof rig.open>) => rig.finishAlone(table, "charlie")
/** A table that has just started: Alice and Bob left two minutes ago, Charlie is here. */
const openTable = () => rig.open({ present: ["charlie"] })

const cardsPlayedBy = (log: LogEntry<CourtisansEvent>[], playerId: string) => log.filter(({ event }) => event.type === "cardPlayed" && event.playerId === playerId).length

describe("absent players", () => {
  it("lets the third player finish a game where the other two never came back", () => {
    let table = openTable()
    expect(presentPlayers(PLAYERS, table.seen, table.now)).toEqual(["charlie"])
    // The opening is a simultaneous step: the game waits for all three, and Charlie's vote is for the two who are away
    expect(waitingPlayers(GAME, table.state)).toEqual(["alice", "bob", "charlie"])
    table = act(table, "charlie")
    expect(waitingPlayers(GAME, table.state)).toEqual(["alice", "bob"])

    // Nobody moves for a whole delay. Charlie is the only present member, so his vote for both is enough: they read their missions in the same write, and the banquet starts
    const { table: banquet, play } = takeover(wait(table, turnTimeout * SECOND), "charlie")
    expect(play).toEqual(["alice", "bob"])
    expect(banquet.state.read).toEqual([true, true, true])
    expect(waitingPlayers(GAME, banquet.state)).toHaveLength(1)
    expect(banquet.votes).toEqual([])

    // Then the turns, one after another, until the end of the game
    const { table: end, takeovers } = finishAlone(banquet)
    expect(GAME.isOver(end.state)).toBe(true)
    // The absent players were played for, turn after turn, and every card of the game was played by somebody
    expect(takeovers.alice).toBeGreaterThan(1)
    expect(takeovers.bob).toBeGreaterThan(1)
    expect(cardsPlayedBy(end.log, "alice")).toBeGreaterThan(0)
    expect(cardsPlayedBy(end.log, "bob")).toBeGreaterThan(0)
    expect(PLAYERS.reduce((sum, player) => sum + cardsPlayedBy(end.log, player.id), 0)).toBe(72)
    // ...and everybody has a result, and somebody won
    const results = GAME.view(end.state, "charlie").results
    expect(results?.players).toHaveLength(3)
    expect(results?.winners.length).toBeGreaterThan(0)
  })

  it("plays for one absent player of the opening at a time when asked to", () => {
    const table = act(openTable(), "charlie")
    const first = takeover(wait(table, turnTimeout * SECOND), "charlie", ["alice"])
    expect(first.play).toEqual(["alice"])
    expect(first.table.state.read).toEqual([true, false, true])
    expect(waitingPlayers(GAME, first.table.state)).toEqual(["bob"])

    const second = takeover(wait(first.table, turnTimeout * SECOND), "charlie", ["bob"])
    expect(second.play).toEqual(["bob"])
    expect(waitingPlayers(GAME, second.table.state)).toHaveLength(1)
    expect(second.table.state.read.every(Boolean)).toBe(true)
  })

  it("needs the vote of every present player other than the one played for", () => {
    // Everybody is here this time and the banquet is on: the player the game waits for is played for once the two others have voted
    let start = openTable()
    for (const { id } of PLAYERS) start = act(start, id)
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
