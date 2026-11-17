import { describe, expect, it } from "vitest"
import { splitRounded, splitWindow } from "./scroll-classes"

/** A popover and a window are boxes whose callers give classes: which are for the box that clips and which for the element inside it that scrolls. */
describe("the classes of a popover", () => {
  it("gives the corners to the panel and every other class to the element that scrolls", () => {
    expect(splitRounded("w-80 gap-0 rounded-2xl p-3")).toEqual({ box: "rounded-2xl", scroller: "w-80 gap-0 p-3" })
    expect(splitRounded("w-52 gap-0 p-0")).toEqual({ box: "", scroller: "w-52 gap-0 p-0" })
  })

  it("reads a class with its variants, and does not mistake another class for a corner", () => {
    expect(splitRounded("sm:rounded-lg p-4 data-[open]:rounded-none")).toEqual({ box: "sm:rounded-lg data-[open]:rounded-none", scroller: "p-4" })
    expect(splitRounded("roundedness-x p-1")).toEqual({ box: "", scroller: "roundedness-x p-1" })
  })

  it("is empty when its caller says nothing", () => {
    expect(splitRounded(undefined)).toEqual({ box: "", scroller: "" })
    expect(splitRounded("  ")).toEqual({ box: "", scroller: "" })
  })
})

describe("the classes of a window", () => {
  it("is one box when it does not scroll: nothing is split", () => {
    expect(splitWindow(undefined)).toBeNull()
    expect(splitWindow("gap-0 overflow-hidden p-0")).toBeNull()
    expect(splitWindow("sm:max-w-sm")).toBeNull()
    expect(splitWindow("overflow-x-auto")).toBeNull()
  })

  it("keeps its width and its corners when it scrolls, and gives the rest to the element that scrolls", () => {
    expect(splitWindow("max-h-[88vh] overflow-y-auto sm:max-w-md")).toEqual({ box: "sm:max-w-md", scroller: "max-h-[88vh] overflow-y-auto" })
    expect(splitWindow("w-[min(92vw,30rem)] max-h-[92vh] overflow-auto rounded-2xl")).toEqual({ box: "w-[min(92vw,30rem)] rounded-2xl", scroller: "max-h-[92vh] overflow-auto" })
    expect(splitWindow("max-h-svh overflow-y-scroll min-w-0")).toEqual({ box: "min-w-0", scroller: "max-h-svh overflow-y-scroll" })
  })

  it("reads the scroll with its variants too", () => {
    expect(splitWindow("sm:overflow-y-auto max-h-80")).toEqual({ box: "", scroller: "sm:overflow-y-auto max-h-80" })
  })
})
