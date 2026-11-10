import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SOCIAL_BACKOFF_MAX_MS, SOCIAL_EVERY_MS, SOCIAL_MIN_GAP_MS, nextSocialDelay, startSocialSync } from "./social-sync"

describe("nextSocialDelay", () => {
  it("is the usual time after a read that went through, whatever the wait was", () => {
    expect(SOCIAL_EVERY_MS).toBe(20_000)
    expect(nextSocialDelay(SOCIAL_EVERY_MS, true)).toBe(SOCIAL_EVERY_MS)
    expect(nextSocialDelay(160_000, true)).toBe(SOCIAL_EVERY_MS)
  })

  it("doubles after a read that failed, up to five minutes", () => {
    expect(nextSocialDelay(20_000, false)).toBe(40_000)
    expect(nextSocialDelay(40_000, false)).toBe(80_000)
    expect(nextSocialDelay(200_000, false)).toBe(SOCIAL_BACKOFF_MAX_MS)
    expect(nextSocialDelay(SOCIAL_BACKOFF_MAX_MS, false)).toBe(SOCIAL_BACKOFF_MAX_MS)
  })
})

describe("startSocialSync", () => {
  let tabInView = true
  let comeBack: (() => void) | null = null
  const load = vi.fn<() => Promise<boolean>>()
  const environment = () => ({
    load,
    visible: () => tabInView,
    onVisible: (callback: () => void) => {
      comeBack = callback
      return () => {
        comeBack = null
      }
    },
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"))
    tabInView = true
    comeBack = null
    load.mockReset()
    load.mockResolvedValue(true)
  })
  afterEach(() => vi.useRealTimers())

  it("reads at once, then every 20 seconds while a tab is in view", async () => {
    const sync = startSocialSync(environment())
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(SOCIAL_EVERY_MS - 1)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(load).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(SOCIAL_EVERY_MS)
    expect(load).toHaveBeenCalledTimes(3)
    sync.stop()
  })

  it("skips the read of a tab that is not in view, and goes on at the next time", async () => {
    const sync = startSocialSync(environment())
    await vi.advanceTimersByTimeAsync(0)
    tabInView = false
    await vi.advanceTimersByTimeAsync(SOCIAL_EVERY_MS * 3)
    expect(load).toHaveBeenCalledTimes(1)
    tabInView = true
    await vi.advanceTimersByTimeAsync(SOCIAL_EVERY_MS)
    expect(load).toHaveBeenCalledTimes(2)
    sync.stop()
  })

  it("reads at once when a tab comes back into view, but not twice within five seconds", async () => {
    const sync = startSocialSync(environment())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(SOCIAL_MIN_GAP_MS - 1)
    comeBack?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    comeBack?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(2)
    sync.stop()
  })

  it("does not read for a tab that comes into view when none is", async () => {
    const sync = startSocialSync(environment())
    await vi.advanceTimersByTimeAsync(SOCIAL_MIN_GAP_MS)
    tabInView = false
    comeBack?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(1)
    sync.stop()
  })

  it("reads when the page asks, whatever the time since the last read", async () => {
    const sync = startSocialSync(environment())
    await vi.advanceTimersByTimeAsync(0)
    sync.refresh()
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(2)
    sync.stop()
  })

  it("makes one read follow the one on its way when the page asks meanwhile, and no more than one however many ask", async () => {
    let finish: (ok: boolean) => void = () => {}
    load.mockImplementationOnce(() => new Promise<boolean>((resolve) => (finish = resolve)))
    const sync = startSocialSync(environment())
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(1)
    sync.refresh()
    sync.refresh()
    sync.refresh()
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(1)
    finish(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(2)
    sync.stop()
  })

  it("waits twice as long after a read that failed, and the usual time after one that went through", async () => {
    load.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true)
    const sync = startSocialSync(environment())
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(39_999)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(load).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(79_999)
    expect(load).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(load).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(SOCIAL_EVERY_MS)
    expect(load).toHaveBeenCalledTimes(4)
    sync.stop()
  })

  it("counts a read that throws as one that failed, and goes on", async () => {
    load.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(true)
    const sync = startSocialSync(environment())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(40_000)
    expect(load).toHaveBeenCalledTimes(2)
    sync.stop()
  })

  it("reads nothing once it is stopped, and does not hear the tab any more", async () => {
    const sync = startSocialSync(environment())
    await vi.advanceTimersByTimeAsync(0)
    sync.stop()
    expect(comeBack).toBeNull()
    sync.refresh()
    await vi.advanceTimersByTimeAsync(SOCIAL_EVERY_MS * 5)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("does not read again after it was stopped while a read was on its way", async () => {
    let finish: (ok: boolean) => void = () => {}
    load.mockImplementationOnce(() => new Promise<boolean>((resolve) => (finish = resolve)))
    const sync = startSocialSync(environment())
    await vi.advanceTimersByTimeAsync(0)
    sync.refresh()
    sync.stop()
    finish(true)
    await vi.advanceTimersByTimeAsync(SOCIAL_EVERY_MS * 3)
    expect(load).toHaveBeenCalledTimes(1)
  })
})
