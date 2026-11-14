import { describe, expect, it } from "vitest"
import { canRedo, canUndo, changedKeys, HISTORY_LIMIT, type Kind, record, redo, startHistory, undo } from "./history"

type S = { a: number; b: number; view: number }
const classify = (keys: readonly string[]): Kind => (keys.every((key) => key === "view") ? "ignore" : keys.every((key) => key === "b") ? "merge" : "push")
const at = (a: number, b = 0, view = 0): S => ({ a, b, view })

describe("record", () => {
  it("stores the state before a change and empties what could be given again", () => {
    let h = startHistory(at(0))
    h = record(h, at(1), classify)
    h = record(h, at(2), classify)
    expect(h.past).toEqual([at(0), at(1)])
    h = undo(h)
    expect(h.future).toEqual([at(2)])
    h = record(h, at(5), classify)
    expect(h.future).toEqual([])
    expect(canRedo(h)).toBe(false)
  })

  it("leaves no entry for an ignored change, but keeps the present up to date", () => {
    const h = record(startHistory(at(0)), at(0, 0, 9), classify)
    expect(h.past).toEqual([])
    expect(h.present.view).toBe(9)
  })

  it("joins the changes of one field in a row into one entry, and not after another change in between", () => {
    let h = startHistory(at(0))
    h = record(h, at(1), classify)
    for (const b of [1, 2, 3]) h = record(h, at(1, b), classify)
    expect(h.past).toHaveLength(2)
    h = record(h, at(2, 3), classify)
    h = record(h, at(2, 4), classify)
    expect(h.past).toHaveLength(4)
  })

  it("does not change on the very same state, and keeps the last states only", () => {
    const h = startHistory(at(0))
    expect(record(h, h.present, classify)).toBe(h)
    let long = h
    for (let n = 1; n <= HISTORY_LIMIT + 10; n++) long = record(long, at(n), classify)
    expect(long.past).toHaveLength(HISTORY_LIMIT)
    expect(long.past[0]).toEqual(at(10))
  })
})

describe("undo and redo", () => {
  it("go back and forth, and do nothing at the ends", () => {
    let h = record(record(startHistory(at(0)), at(1), classify), at(2), classify)
    expect(canUndo(h)).toBe(true)
    h = undo(h)
    expect(h.present).toEqual(at(1))
    h = undo(h)
    expect(undo(h)).toBe(h)
    h = redo(redo(h))
    expect(h.present).toEqual(at(2))
    expect(redo(h)).toBe(h)
  })

  it("keeps what `keep` takes from the present, such as the camera", () => {
    let h = record(startHistory(at(0)), at(1), classify)
    h = record(h, at(1, 0, 7), classify)
    const back = undo(h, (before, now) => ({ ...before, view: now.view }))
    expect(back.present).toEqual(at(0, 0, 7))
  })
})

describe("changedKeys", () => {
  it("lists the fields that differ, sorted", () => {
    expect(changedKeys({ b: 1, a: 1, c: 1 }, { b: 2, a: 2, c: 1 })).toEqual(["a", "b"])
  })
})
