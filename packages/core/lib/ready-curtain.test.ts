import { describe, expect, it } from "vitest"
import { collectiveProgress, curtainState, loadingRows, MAX_WHILE_LOADING, READY_LOAD_GRACE_MS, secondsLeft } from "./ready-curtain"

describe("curtainState", () => {
  it("keeps a table in its ready check behind the screen until the game begins, whatever the board and the table know", () => {
    expect(curtainState({ status: "starting", marked: false, loaded: false })).toBe("loading")
    expect(curtainState({ status: "starting", marked: false, loaded: true })).toBe("waiting")
    expect(curtainState({ status: "starting", marked: true, loaded: true })).toBe("waiting")
    // Back in the page after the table had them down as ready: the board is still loading, the others are the ones waited for
    expect(curtainState({ status: "starting", marked: true, loaded: false })).toBe("waiting")
  })

  it("lifts it when the game has begun and the player's own board is there", () => {
    expect(curtainState({ status: "playing", marked: false, loaded: true })).toBe("lifted")
    expect(curtainState({ status: "playing", marked: true, loaded: true })).toBe("lifted")
    // The game began while their board was still loading: it lifts as soon as it is
    expect(curtainState({ status: "playing", marked: true, loaded: false })).toBe("loading")
  })

  it("has no barrier for a player who comes back to a game under way: the screen waits for their board only", () => {
    expect(curtainState({ status: "playing", marked: false, loaded: false })).toBe("loading")
    expect(curtainState({ status: "playing", marked: false, loaded: true })).toBe("lifted")
  })

  it("never draws a screen over the end of a game", () => {
    for (const marked of [true, false]) for (const loaded of [true, false]) expect(curtainState({ status: "over", marked, loaded })).toBe("lifted")
  })
})

describe("secondsLeft", () => {
  it("counts down from what the server said when it said it, rounded up", () => {
    expect(secondsLeft(60_000, 1000, 1000)).toBe(60)
    expect(secondsLeft(60_000, 1000, 1001)).toBe(60)
    expect(secondsLeft(60_000, 1000, 1500)).toBe(60)
    expect(secondsLeft(60_000, 1000, 2000)).toBe(59)
    expect(secondsLeft(60_000, 1000, 60_999)).toBe(1)
  })

  it("is 0 once the time is up, and null outside a ready check", () => {
    expect(secondsLeft(60_000, 1000, 61_000)).toBe(0)
    expect(secondsLeft(60_000, 1000, 90_000)).toBe(0)
    expect(secondsLeft(null, 1000, 2000)).toBeNull()
  })
})

describe("READY_LOAD_GRACE_MS", () => {
  it("leaves a slow board a good part of the minute to load, and still room for the others to see it ready", () => {
    expect(READY_LOAD_GRACE_MS).toBeGreaterThanOrEqual(10_000)
    expect(READY_LOAD_GRACE_MS).toBeLessThan(60_000)
  })
})

describe("loadingRows", () => {
  const players = [
    { id: "p1", nickname: "Ann", avatarUrl: "https://cdn.example/ann.png" },
    { id: "p2", nickname: "Bob" },
    { id: "p3", nickname: "Cy" },
  ]

  it("lists every seat in seat order with how far each board is: the table's marks first, then what the boards report, the viewer's own known here", () => {
    expect(loadingRows({ players, ready: ["p3"], reported: { p2: 0.4, p1: 0.9 }, meId: "p1", own: 0.7 })).toEqual([
      { id: "p1", name: "Ann", avatarUrl: "https://cdn.example/ann.png", me: true, ready: false, progress: 0.7 },
      { id: "p2", name: "Bob", avatarUrl: null, me: false, ready: false, progress: 0.4 },
      { id: "p3", name: "Cy", avatarUrl: null, me: false, ready: true, progress: 1 },
    ])
  })

  it("is full for a seat the table has down as ready and never full before: a board that says it is done is not yet marked", () => {
    const rows = loadingRows({ players, ready: ["p2"], reported: { p3: 1 }, meId: "p1", own: 1 })
    expect(rows.map((row) => row.progress)).toEqual([MAX_WHILE_LOADING, 1, MAX_WHILE_LOADING])
  })

  it("reads a seat nobody has reported for as not started, and ignores what is not a share", () => {
    const rows = loadingRows({ players, ready: [], reported: { p2: Number.NaN, p3: -2, ghost: 1 }, meId: null, own: 1 })
    expect(rows.map((row) => row.progress)).toEqual([0, 0, 0])
    expect(loadingRows({ players, ready: [], reported: { p2: 7 }, meId: null, own: 0 })[1]?.progress).toBe(MAX_WHILE_LOADING)
  })
})

describe("collectiveProgress", () => {
  it("is the mean of the boards", () => {
    expect(collectiveProgress([{ progress: 1 }, { progress: 0.5 }, { progress: 0 }])).toBeCloseTo(0.5, 10)
    expect(collectiveProgress([{ progress: 1 }, { progress: 1 }])).toBe(1)
  })

  it("is nothing for an empty table", () => {
    expect(collectiveProgress([])).toBe(0)
  })
})
