import { describe, expect, it, vi } from "vitest"
import { circleShape, rectShape } from "./shapes"
import { createDragStore } from "./store"

describe("the zones of a table", () => {
  it("finds the zone that holds a point, and none where there is none", () => {
    const store = createDragStore()
    store.register("play", rectShape(0, 0, 4, 4))
    store.register("discard", rectShape(6, 0, 4, 4))
    expect(store.zoneAt(1, 1)).toBe("play")
    expect(store.zoneAt(6, 0)).toBe("discard")
    expect(store.zoneAt(3, 0)).toBeNull()
    expect(store.count()).toBe(2)
  })

  it("takes a zone away when what put it there does", () => {
    const store = createDragStore()
    const off = store.register("play", rectShape(0, 0, 4, 4))
    expect(store.zoneAt(0, 0)).toBe("play")
    off()
    expect(store.zoneAt(0, 0)).toBeNull()
    expect(store.count()).toBe(0)
    // Twice does no harm
    off()
    expect(store.count()).toBe(0)
  })

  it("prefers the smaller zone when one lies on another", () => {
    const store = createDragStore()
    store.register("table", rectShape(0, 0, 20, 20))
    store.register("slot", rectShape(0, 0, 2, 2))
    expect(store.zoneAt(0, 0)).toBe("slot")
    expect(store.zoneAt(5, 5)).toBe("table")
  })

  it("prefers the last of two zones as small as each other", () => {
    const store = createDragStore()
    store.register("under", rectShape(0, 0, 2, 2))
    store.register("over", rectShape(0, 0, 2, 2))
    expect(store.zoneAt(0, 0)).toBe("over")
  })

  it("looks only at the zones it is asked for, and finds the larger one when the smaller is not among them", () => {
    const store = createDragStore()
    store.register("table", rectShape(0, 0, 20, 20))
    store.register("slot", circleShape(0, 0, 1))
    expect(store.zoneAt(0, 0, ["table"])).toBe("table")
    expect(store.zoneAt(0, 0, ["slot"])).toBe("slot")
    expect(store.zoneAt(0, 0, [])).toBeNull()
    expect(store.zoneAt(0, 0, null)).toBe("slot")
  })

  it("lets one id have two shapes", () => {
    const store = createDragStore()
    store.register("play", rectShape(-5, 0, 2, 2))
    store.register("play", rectShape(5, 0, 2, 2))
    expect(store.zoneAt(-5, 0)).toBe("play")
    expect(store.zoneAt(5, 0)).toBe("play")
  })

  it("tells a cell of a board by its number", () => {
    const store = createDragStore()
    store.register(0, rectShape(0, 0, 1, 1))
    store.register(1, rectShape(1, 0, 1, 1))
    expect(store.zoneAt(1.2, 0.2)).toBe(1)
  })
})

describe("a drag over the zones", () => {
  it("is idle until one begins, and ends idle", () => {
    const store = createDragStore()
    expect(store.snapshot()).toEqual({ dragging: false, legal: null, over: null })
    expect(store.begin(["play"])).toBe(true)
    expect(store.snapshot()).toEqual({ dragging: true, legal: ["play"], over: null })
    store.end()
    expect(store.snapshot()).toEqual({ dragging: false, legal: null, over: null })
  })

  it("allows one drag at a time", () => {
    const store = createDragStore()
    expect(store.begin(null)).toBe(true)
    expect(store.begin(["play"])).toBe(false)
    expect(store.snapshot().legal).toBeNull()
  })

  it("says which zone the thing is over, among the ones it may go on", () => {
    const store = createDragStore()
    store.register("play", rectShape(0, 0, 4, 4))
    store.register("discard", rectShape(6, 0, 4, 4))
    store.begin(["play"])
    expect(store.move(0, 0)).toBe("play")
    expect(store.snapshot().over).toBe("play")
    // Over a zone it may not go on is over none
    expect(store.move(6, 0)).toBeNull()
    expect(store.snapshot().over).toBeNull()
  })

  it("is over any zone when it may go on any", () => {
    const store = createDragStore()
    store.register("discard", rectShape(6, 0, 4, 4))
    store.begin(null)
    expect(store.move(6, 0)).toBe("discard")
  })

  it("has no zone to be over when nothing is held", () => {
    const store = createDragStore()
    store.register("play", rectShape(0, 0, 4, 4))
    expect(store.move(0, 0)).toBeNull()
    expect(store.snapshot().over).toBeNull()
  })

  it("keeps the same snapshot until something changes, and tells its listeners when it does", () => {
    const store = createDragStore()
    store.register("play", rectShape(0, 0, 4, 4))
    const listener = vi.fn()
    const off = store.subscribe(listener)
    store.begin(null)
    expect(listener).toHaveBeenCalledTimes(1)
    store.move(0, 0)
    expect(listener).toHaveBeenCalledTimes(2)
    const before = store.snapshot()
    // Still over the same zone: no change, so no new snapshot and nobody is told
    store.move(1, 1)
    expect(store.snapshot()).toBe(before)
    expect(listener).toHaveBeenCalledTimes(2)
    store.end()
    expect(listener).toHaveBeenCalledTimes(3)
    // An end with no drag is not a change
    store.end()
    expect(listener).toHaveBeenCalledTimes(3)
    off()
    store.begin(null)
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
