import { describe, expect, it } from "vitest"
import { checkWords, collectiveProgress, curtainState, failedCheck, loadingRows, MAX_WHILE_LOADING, READY_LOAD_GRACE_MS, secondsLeft } from "./ready-curtain"

describe("curtainState", () => {
  const check = (confirmed: boolean, marked: boolean, loaded: boolean) => curtainState({ status: "starting", confirmed, marked, loaded })

  it("asks a player to press before anything else, whatever their board is doing: a board that is loaded does not make them ready", () => {
    expect(check(false, false, false)).toBe("confirm")
    expect(check(false, false, true)).toBe("confirm")
  })

  it("keeps a press made before the board is loaded: the player waits for their board, then for the others", () => {
    expect(check(true, false, false)).toBe("loading")
    expect(check(true, false, true)).toBe("waiting")
  })

  it("asks nobody twice: a player the table has down as ready, back in the page, waits for the others, with no button and whatever the board is doing", () => {
    for (const confirmed of [true, false]) for (const loaded of [true, false]) expect(check(confirmed, true, loaded), `${confirmed} ${loaded}`).toBe("waiting")
  })

  it("keeps a table in its ready check behind the screen until the game begins, whoever has pressed and whoever has not", () => {
    for (const confirmed of [true, false]) for (const marked of [true, false]) for (const loaded of [true, false]) expect(check(confirmed, marked, loaded)).not.toBe("lifted")
  })

  it("lifts it when the game has begun and the player's own board is there", () => {
    expect(curtainState({ status: "playing", confirmed: true, marked: false, loaded: true })).toBe("lifted")
    expect(curtainState({ status: "playing", confirmed: true, marked: true, loaded: true })).toBe("lifted")
    // The game began while their board was still loading: it lifts as soon as it is
    expect(curtainState({ status: "playing", confirmed: true, marked: true, loaded: false })).toBe("loading")
  })

  it("has no button and no barrier for a player who comes back to a game under way: the screen waits for their board only", () => {
    expect(curtainState({ status: "playing", confirmed: false, marked: false, loaded: false })).toBe("loading")
    expect(curtainState({ status: "playing", confirmed: false, marked: false, loaded: true })).toBe("lifted")
  })

  it("never draws a screen over the end of a game", () => {
    for (const confirmed of [true, false]) for (const marked of [true, false]) for (const loaded of [true, false]) expect(curtainState({ status: "over", confirmed, marked, loaded })).toBe("lifted")
  })
})

describe("checkWords", () => {
  it("asks the player if they are there, with a button that says so, until they press it", () => {
    expect(checkWords("confirm")).toEqual({ title: "Are you there?", subtitle: "The game starts when every player has confirmed.", button: "I'm here" })
  })

  it("says what is awaited once they have, whether it is their board or the other players", () => {
    expect(checkWords("loading").title).toBe("Setting up the table")
    expect(checkWords("waiting").title).toBe("Waiting for the other players")
    for (const state of ["loading", "waiting"] as const) expect(checkWords(state)).toMatchObject({ subtitle: "The game starts when every player has confirmed.", button: "Waiting for the others" })
  })
})

describe("failedCheck", () => {
  const seen = { sawCheck: true, began: false, unknown: false }

  it("sends the players back to the table when it is in the lobby again with the players who were ready, the one who was not ready included", () => {
    expect(failedCheck({ ...seen, status: "lobby", players: 1 })).toBe("table")
    expect(failedCheck({ ...seen, status: "lobby", players: 4 })).toBe("table")
  })

  it("sends them to the game's page when nobody was ready: the table is empty, or already deleted, and there is none to go back to", () => {
    expect(failedCheck({ ...seen, status: "lobby", players: 0 })).toBe("game")
    expect(failedCheck({ ...seen, status: "starting", players: 2, unknown: true })).toBe("game")
    expect(failedCheck({ ...seen, status: null, players: 0, unknown: true })).toBe("game")
  })

  it("says nothing while the check is on, and once the game has begun, whatever happens to the table after", () => {
    expect(failedCheck({ ...seen, status: "starting", players: 2 })).toBeNull()
    expect(failedCheck({ ...seen, began: true, status: "playing", players: 2 })).toBeNull()
    expect(failedCheck({ ...seen, began: true, status: "over", players: 2 })).toBeNull()
    // A game that began and whose table is gone later (everybody left it, or it was cleaned up) is not a check that fell through
    expect(failedCheck({ ...seen, began: true, status: "playing", players: 0, unknown: true })).toBeNull()
  })

  it("says nothing of a table whose check this page never saw: a lobby it is shown is the platform's to open", () => {
    expect(failedCheck({ sawCheck: false, began: false, unknown: false, status: "lobby", players: 2 })).toBeNull()
    expect(failedCheck({ sawCheck: false, began: false, unknown: true, status: null, players: 0 })).toBeNull()
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

  it("does not list a player ready who pressed before their board was loaded: the table has no mark for them yet, their row shows how far their board is", () => {
    const rows = loadingRows({ players, ready: ["p2"], reported: { p2: 1, p3: 0.5 }, meId: "p1", own: 0.35 })
    expect(rows.map((row) => [row.id, row.ready, row.progress])).toEqual([
      ["p1", false, 0.35],
      ["p2", true, 1],
      ["p3", false, 0.5],
    ])
  })

  it("does not list a player ready whose board is loaded and who has not pressed: they show at most what a board that is not marked can", () => {
    const rows = loadingRows({ players, ready: [], reported: { p2: 1 }, meId: "p1", own: 1 })
    expect(rows.map((row) => [row.ready, row.progress])).toEqual([
      [false, MAX_WHILE_LOADING],
      [false, MAX_WHILE_LOADING],
      [false, 0],
    ])
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
