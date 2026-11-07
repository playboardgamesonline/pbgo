import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BEAT_BACKOFF_MAX_MS, BEAT_EVERY_MS, BEAT_MIN_GAP_MS, nextBeatDelay, startBeating } from "./presence"

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

describe("startBeating", () => {
  let inView = true
  let comesIntoView: (() => void) | null = null
  const unsubscribe = vi.fn()
  const send = vi.fn<() => Promise<boolean>>(async () => true)
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

  it("stops for good: no more beats, and the listener is removed", async () => {
    const stop = start()
    await tick(0)
    stop()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    await tick(BEAT_EVERY_MS * 5)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
