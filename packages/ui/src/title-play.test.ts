import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { rhythm } from "./platform/title-play"

function setup() {
  const state = { busy: false }
  const start = vi.fn()
  const beat = rhythm({ first: 1000, every: 5000, busy: () => state.busy, start })
  return { state, start, beat }
}

describe("rhythm", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts the first move after `first`, then one every `every`", () => {
    const { start } = setup()
    vi.advanceTimersByTime(999)
    expect(start).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(start).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(start).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(5000)
    expect(start).toHaveBeenCalledTimes(3)
  })

  it("starts at once when it is asked to and nothing is playing, and the next one comes `every` after it", () => {
    const { start, beat } = setup()
    vi.advanceTimersByTime(300)
    beat.play()
    expect(start).toHaveBeenCalledTimes(1)
    // The first move, set for 1000, does not come: the next is 5000 after the one that was asked for
    vi.advanceTimersByTime(4999)
    expect(start).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(start).toHaveBeenCalledTimes(2)
  })

  it("leaves a move that is playing alone: it is not started over, and the time of the next one does not move", () => {
    const { state, start, beat } = setup()
    vi.advanceTimersByTime(1000)
    expect(start).toHaveBeenCalledTimes(1)
    state.busy = true
    vi.advanceTimersByTime(2000)
    beat.play()
    beat.play()
    expect(start).toHaveBeenCalledTimes(1)
    state.busy = false
    // The next one is 5000 after the first, as it was set
    vi.advanceTimersByTime(2999)
    expect(start).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(start).toHaveBeenCalledTimes(2)
  })

  it("skips a beat that falls while the move is playing, and goes on with the next", () => {
    const { state, start } = setup()
    vi.advanceTimersByTime(1000)
    expect(start).toHaveBeenCalledTimes(1)
    state.busy = true
    vi.advanceTimersByTime(5000)
    expect(start).toHaveBeenCalledTimes(1)
    state.busy = false
    vi.advanceTimersByTime(5000)
    expect(start).toHaveBeenCalledTimes(2)
  })

  it("asks for nothing once it is stopped", () => {
    const { start, beat } = setup()
    beat.stop()
    vi.advanceTimersByTime(60_000)
    expect(start).not.toHaveBeenCalled()
  })
})
