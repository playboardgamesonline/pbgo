import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BEAT_BACKOFF_MAX_MS, BEAT_EVERY_MS, BEAT_MIN_GAP_MS, BEAT_SOON_MS, nextBeatDelay, readBeatAnswer, startBeating, takenToGame, type BeatResult } from "./presence"

describe("the beat", () => {
  it("is well inside the two minutes that the players online keep a member", () => {
    expect(BEAT_EVERY_MS * 2).toBeLessThan(2 * 60_000)
  })

  it("goes back to the usual delay after a beat that went through", () => {
    expect(nextBeatDelay(BEAT_EVERY_MS, true)).toBe(BEAT_EVERY_MS)
    expect(nextBeatDelay(BEAT_BACKOFF_MAX_MS, true)).toBe(BEAT_EVERY_MS)
  })

  it("waits twice as long after each beat that did not, up to a ceiling", () => {
    const waits = [BEAT_EVERY_MS]
    for (let i = 0; i < 6; i++) waits.push(nextBeatDelay(waits.at(-1)!, false))
    expect(waits.slice(0, 4)).toEqual([45_000, 90_000, 180_000, BEAT_BACKOFF_MAX_MS])
    expect(waits.at(-1)).toBe(BEAT_BACKOFF_MAX_MS)
  })
})

describe("the beat of a member who has a table that may begin", () => {
  it("is as short as a beat can be, well inside the minute of a ready check", () => {
    expect(BEAT_SOON_MS).toBe(BEAT_MIN_GAP_MS)
    expect(BEAT_SOON_MS).toBeLessThan(60_000 / 2)
  })

  it("comes soon after a beat that says so, whatever the last wait was, and the usual wait comes back with the next plain one", () => {
    expect(nextBeatDelay(BEAT_EVERY_MS, "soon")).toBe(BEAT_SOON_MS)
    expect(nextBeatDelay(BEAT_BACKOFF_MAX_MS, "soon")).toBe(BEAT_SOON_MS)
    expect(nextBeatDelay(BEAT_SOON_MS, true)).toBe(BEAT_EVERY_MS)
  })
})

describe("readBeatAnswer", () => {
  it("reads the table a member is taken to, what it is at, and whether they have one that may begin", () => {
    expect(readBeatAnswer({ ok: true, table: { game: "courtisans", code: "ABC234", status: "playing" }, watching: true })).toEqual({ table: { game: "courtisans", code: "ABC234", status: "playing" }, watching: true })
    expect(readBeatAnswer({ ok: true, table: { game: "courtisans", code: "ABC234", status: "starting" }, watching: true })).toEqual({ table: { game: "courtisans", code: "ABC234", status: "starting" }, watching: true })
    expect(readBeatAnswer({ ok: true, table: null, watching: false })).toEqual({ table: null, watching: false })
    expect(readBeatAnswer({ ok: true })).toEqual({ table: null, watching: false })
  })

  it("reads a table with no status, or with one it does not know, as in its ready check: only the word `playing` leaves a member alone", () => {
    expect(readBeatAnswer({ table: { game: "courtisans", code: "ABC234" } }).table).toEqual({ game: "courtisans", code: "ABC234", status: "starting" })
    for (const status of ["lobby", "over", "Playing", "PLAYING", " playing", "play", 1, true, null, [], {}]) {
      expect(readBeatAnswer({ table: { game: "courtisans", code: "ABC234", status } }).table?.status, JSON.stringify(status)).toBe("starting")
    }
  })

  it("takes nothing that is not a game and a code for a table, since they make an address", () => {
    for (const table of [
      { game: "../evil", code: "ABC234" },
      { game: "courtisans/../x", code: "ABC234" },
      { game: "Courtisans", code: "ABC234" },
      { game: "courtisans", code: "abc234" },
      { game: "courtisans", code: "AB" },
      { game: "courtisans", code: "ABC234/../x" },
      { game: "courtisans", code: 234 },
      { game: 1, code: "ABC234" },
      { game: "courtisans" },
      "courtisans/ABC234",
      [],
      null,
    ]) {
      expect(readBeatAnswer({ table }).table, JSON.stringify(table)).toBeNull()
    }
  })

  it("says nothing for an answer that is not one", () => {
    for (const answer of [null, undefined, "yes", 42, [], { watching: "yes" }]) expect(readBeatAnswer(answer)).toEqual({ table: null, watching: false })
  })
})

describe("takenToGame", () => {
  const LEGAL = ["/legal", "/legal/cookies", "/legal/privacy", "/legal/terms"]
  const PROFILES = ["/player/Marly-0042", "/player/Marly-0042/"]
  const OWN = ["/me", "/me/games", "/me/friends", "/me/settings", "/me/settings/account", "/me/settings/language"]
  const OTHERS = ["/", "/home", "/games", "/game/courtisans", "/game/courtisans/ABC234", "/tables", "/tournaments", "/about", "/login", "/docs/design", "/auth/reopen-account"]

  it("takes a member whose table is in its ready check from every page of the hub but the legal ones: nobody misses the confirmation", () => {
    for (const page of [...OTHERS, ...PROFILES, ...OWN]) expect(takenToGame(page, "starting"), page).toBe(true)
    for (const page of LEGAL) expect(takenToGame(page, "starting"), page).toBe(false)
    expect(takenToGame("/legalese", "starting")).toBe(true)
  })

  it("takes a member who is playing from every page but the legal ones, a player's profile and their own pages", () => {
    for (const page of OTHERS) expect(takenToGame(page, "playing"), page).toBe(true)
    for (const page of [...LEGAL, ...PROFILES, ...OWN]) expect(takenToGame(page, "playing"), page).toBe(false)
  })

  it("reads a page as one of these by its whole first segment, not by its first letters, and by where it starts, not by what it holds", () => {
    for (const page of ["/legalese", "/players", "/medals", "/media", "/members", "/me-too", "/games/me", "/game/me", "/game/player/ABC234", "/docs/me"]) expect(takenToGame(page, "playing"), page).toBe(true)
  })
})

describe("startBeating", () => {
  let inView = true
  let comesIntoView: (() => void) | null = null
  const unsubscribe = vi.fn()
  const send = vi.fn<() => Promise<BeatResult>>(async () => true)
  const start = () =>
    startBeating({
      send,
      visible: () => inView,
      onVisible: (callback) => {
        comesIntoView = callback
        return unsubscribe
      },
    })
  const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"))
    inView = true
    comesIntoView = null
    unsubscribe.mockReset()
    send.mockReset()
    send.mockResolvedValue(true)
  })
  afterEach(() => vi.useRealTimers())

  it("beats at once, then every 45 seconds", async () => {
    const stop = start()
    await tick(0)
    expect(send).toHaveBeenCalledTimes(1)
    await tick(BEAT_EVERY_MS)
    expect(send).toHaveBeenCalledTimes(2)
    await tick(BEAT_EVERY_MS * 2)
    expect(send).toHaveBeenCalledTimes(4)
    stop()
  })

  it("skips the beats of a tab that is not in view, and picks up at the next one", async () => {
    inView = false
    const stop = start()
    await tick(BEAT_EVERY_MS * 3)
    expect(send).not.toHaveBeenCalled()
    inView = true
    await tick(BEAT_EVERY_MS)
    expect(send).toHaveBeenCalledTimes(1)
    stop()
  })

  it("beats at once when a tab comes back into view, but not twice within the minimum gap", async () => {
    const stop = start()
    await tick(0)
    expect(send).toHaveBeenCalledTimes(1)
    comesIntoView!()
    await tick(0)
    expect(send).toHaveBeenCalledTimes(1)
    await tick(BEAT_MIN_GAP_MS)
    comesIntoView!()
    await tick(0)
    expect(send).toHaveBeenCalledTimes(2)
    stop()
  })

  it("waits twice as long after a beat that was not taken, or threw, and goes back to the usual wait after one that was", async () => {
    send.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(true)
    const stop = start()
    await tick(0)
    expect(send).toHaveBeenCalledTimes(1)
    await tick(BEAT_EVERY_MS * 2 - 1)
    expect(send).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(send).toHaveBeenCalledTimes(2)
    await tick(BEAT_EVERY_MS * 4 - 1)
    expect(send).toHaveBeenCalledTimes(2)
    await tick(1)
    expect(send).toHaveBeenCalledTimes(3)
    await tick(BEAT_EVERY_MS)
    expect(send).toHaveBeenCalledTimes(4)
    stop()
  })

  it("beats every fifteen seconds while the member has a table that may begin, and goes back to the usual wait when they have none", async () => {
    send.mockResolvedValueOnce("soon").mockResolvedValueOnce("soon").mockResolvedValue(true)
    const stop = start()
    await tick(0)
    expect(send).toHaveBeenCalledTimes(1)
    await tick(BEAT_SOON_MS - 1)
    expect(send).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(send).toHaveBeenCalledTimes(2)
    await tick(BEAT_SOON_MS)
    expect(send).toHaveBeenCalledTimes(3)
    // The third said nothing of a table: the usual wait
    await tick(BEAT_EVERY_MS - 1)
    expect(send).toHaveBeenCalledTimes(3)
    await tick(1)
    expect(send).toHaveBeenCalledTimes(4)
    stop()
  })

  it("stops for good: no more beats, and the listener is removed", async () => {
    const stop = start()
    await tick(0)
    stop()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    await tick(BEAT_EVERY_MS * 5)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
