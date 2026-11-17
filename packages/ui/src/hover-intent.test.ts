import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HOVER_CLOSE_DELAY, HOVER_OPEN_DELAY, hoverIntent } from "./hover-intent"

describe("the rest of a pointer that opens a panel", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const intent = () => {
    const change = vi.fn<(open: boolean) => void>()
    return { change, ...hoverIntent(change) }
  }

  it("opens after a short rest on what opens it, not at once, so that crossing a row of pictures flashes nothing", () => {
    const { change, enter } = intent()
    enter()
    vi.advanceTimersByTime(HOVER_OPEN_DELAY - 1)
    expect(change).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(change).toHaveBeenCalledExactlyOnceWith(true)
  })

  it("opens nothing for a pointer that leaves before the rest is over", () => {
    const { change, enter, leave } = intent()
    enter()
    vi.advanceTimersByTime(HOVER_OPEN_DELAY - 50)
    leave()
    vi.advanceTimersByTime(HOVER_OPEN_DELAY + HOVER_CLOSE_DELAY)
    // The pointer that left asks for a close, which tells a panel that is already shut nothing new
    expect(change).not.toHaveBeenCalledWith(true)
  })

  it("closes after a short grace once the pointer has left, so that it can cross the gap to the panel", () => {
    const { change, leave } = intent()
    leave()
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY - 1)
    expect(change).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(change).toHaveBeenCalledExactlyOnceWith(false)
  })

  it("keeps the panel while the pointer is on it: arriving on the panel drops the close that was waiting", () => {
    const { change, leave, stay } = intent()
    leave()
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY - 20)
    stay()
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY * 2)
    expect(change).not.toHaveBeenCalled()
  })

  it("keeps the panel for a pointer that comes back to what opens it within the grace", () => {
    const { change, enter, leave } = intent()
    leave()
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY - 20)
    enter()
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY - 20)
    expect(change).not.toHaveBeenCalledWith(false)
  })

  it("closes once the pointer leaves the panel too", () => {
    const { change, leave, stay } = intent()
    stay()
    leave()
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY)
    expect(change).toHaveBeenCalledExactlyOnceWith(false)
  })

  it("opens and closes at once for a press or a key, whatever is waiting", () => {
    const { change, enter, open, close } = intent()
    enter()
    open()
    expect(change).toHaveBeenLastCalledWith(true)
    vi.advanceTimersByTime(HOVER_OPEN_DELAY * 2)
    expect(change).toHaveBeenCalledTimes(1)
    close()
    expect(change).toHaveBeenLastCalledWith(false)
    expect(change).toHaveBeenCalledTimes(2)
  })

  it("drops what is waiting when the block goes away or a press decides the panel itself", () => {
    const { change, enter, dispose } = intent()
    enter()
    dispose()
    vi.advanceTimersByTime(HOVER_OPEN_DELAY * 2)
    expect(change).not.toHaveBeenCalled()
  })

  it("rests as long as the platform's hover card does before it opens, and leaves a little longer to cross to a panel that holds controls", () => {
    expect(HOVER_OPEN_DELAY).toBe(200)
    expect(HOVER_CLOSE_DELAY).toBeGreaterThanOrEqual(100)
  })

  it("takes the delays it is given", () => {
    const change = vi.fn()
    const { enter } = hoverIntent(change, { openDelay: 10, closeDelay: 20 })
    enter()
    vi.advanceTimersByTime(10)
    expect(change).toHaveBeenCalledExactlyOnceWith(true)
  })
})
