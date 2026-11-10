import { describe, expect, it } from "vitest"
import { endOf, movePress, startPress } from "./gesture"

describe("a press that becomes a drag", () => {
  it("starts as a click", () => {
    const press = startPress(3, 120, 80)
    expect(press).toEqual({ pointer: 3, x: 120, y: 80, dragging: false })
    expect(endOf(press)).toBe("click")
  })

  it("stays a click while the pointer is near where it went down", () => {
    const press = startPress(1, 100, 100)
    const moved = movePress(press, 1, 103, 104, 6)
    expect(moved.began).toBe(false)
    expect(moved.press).toBe(press)
  })

  it("becomes a drag the first time the pointer is the threshold away, and says so once", () => {
    const first = movePress(startPress(1, 100, 100), 1, 106, 100, 6)
    expect(first.began).toBe(true)
    expect(first.press.dragging).toBe(true)
    expect(endOf(first.press)).toBe("drop")
    const second = movePress(first.press, 1, 200, 200, 6)
    expect(second.began).toBe(false)
    expect(second.press).toBe(first.press)
  })

  it("measures the distance as a straight line, not along each axis", () => {
    expect(movePress(startPress(1, 0, 0), 1, 4, 4, 6).began).toBe(false)
    expect(movePress(startPress(1, 0, 0), 1, 5, 5, 6).began).toBe(true)
  })

  it("stays a drag when the pointer comes back to where it began", () => {
    const { press } = movePress(startPress(1, 100, 100), 1, 150, 100, 6)
    const back = movePress(press, 1, 100, 100, 6)
    expect(back.press.dragging).toBe(true)
    expect(endOf(back.press)).toBe("drop")
  })

  it("ignores another pointer", () => {
    const press = startPress(1, 100, 100)
    const other = movePress(press, 2, 300, 300, 6)
    expect(other.began).toBe(false)
    expect(other.press).toBe(press)
  })

  it("never turns a move of no distance into a drag, even with no threshold", () => {
    expect(movePress(startPress(1, 10, 10), 1, 10, 10, 0).began).toBe(false)
    expect(movePress(startPress(1, 10, 10), 1, 10.5, 10, 0).began).toBe(true)
  })
})
