import { describe, expect, it } from "vitest"
import type { PublicGame, TakeoverStatus } from "./game-types"
import { viewerTakeover } from "./stalled-turn"

type Table = Pick<PublicGame, "meId" | "status" | "takeovers">

const takeover = (playerId: string, voters: string[], votes: string[] = []): TakeoverStatus => ({ playerId, voters, votes })
// `a` is away and the game waits for them; `b` and `c` are present and have to agree
const table = (patch: Partial<Table> = {}): Table => ({ meId: "b", status: "playing", takeovers: [takeover("a", ["b", "c"])], ...patch })

describe("viewerTakeover", () => {
  it("lists the players the viewer is one of the required voters for, in the order the game waits for them", () => {
    const { targets, ids } = viewerTakeover(table({ takeovers: [takeover("a", ["b", "c"]), takeover("d", ["c"]), takeover("e", ["b"])] }))
    expect(ids).toEqual(["a", "e"])
    expect(targets.map((target) => target.playerId)).toEqual(ids)
  })

  it("offers nothing to a spectator, to a stranger or to a player the game waits for", () => {
    expect(viewerTakeover(table({ meId: null })).targets).toEqual([])
    expect(viewerTakeover(table({ meId: "z" })).targets).toEqual([])
    expect(viewerTakeover(table({ meId: "a" })).targets).toEqual([])
  })

  it("offers nothing outside a game in progress", () => {
    for (const status of ["lobby", "starting", "over"] as const) expect(viewerTakeover(table({ status })).targets).toEqual([])
  })

  it("treats a player who is out like any other voter: the table knows them, whatever their view says", () => {
    // `c` was eliminated, so a game may give them a view with no `me`; the table still has their id
    expect(viewerTakeover(table({ meId: "c" })).ids).toEqual(["a"])
  })

  it("has the viewer voted only once they voted for every player", () => {
    const takeovers = [takeover("a", ["b", "c"], ["b"]), takeover("d", ["b", "c"], [])]
    expect(viewerTakeover(table({ takeovers })).voted).toBe(false)
    expect(viewerTakeover(table({ takeovers: [takeover("a", ["b", "c"], ["b"]), takeover("d", ["b", "c"], ["b"])] })).voted).toBe(true)
  })

  it("has not voted a viewer who has nothing to vote on, or whose turn to vote has not come", () => {
    expect(viewerTakeover(table({ meId: "z" })).voted).toBe(false)
    expect(viewerTakeover(table({ takeovers: [takeover("a", ["b", "c"], ["c"])] })).voted).toBe(false)
  })

  it("is complete once every voter required for every player has voted", () => {
    expect(viewerTakeover(table({ takeovers: [takeover("a", ["b", "c"], ["b"])] })).complete).toBe(false)
    expect(viewerTakeover(table({ takeovers: [takeover("a", ["b", "c"], ["b", "c"])] })).complete).toBe(true)
  })

  it("is not complete while the viewer has not voted, even when the others have", () => {
    expect(viewerTakeover(table({ takeovers: [takeover("a", ["b", "c"], ["c"])] })).complete).toBe(false)
  })
})
