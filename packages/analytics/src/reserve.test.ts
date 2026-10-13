import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RESERVED_HEIGHT_VAR, reserveSpace } from "./reserve"

/** The part of a style declaration that `reserveSpace` uses. */
function fakeStyle(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    setProperty: (name: string, value: string) => void values.set(name, value),
    removeProperty: (name: string) => void values.delete(name),
    getPropertyValue: (name: string) => values.get(name) ?? "",
  }
}

class FakeResizeObserver {
  static all: FakeResizeObserver[] = []
  observed: unknown[] = []
  disconnected = false
  constructor(readonly notify: () => void) {
    FakeResizeObserver.all.push(this)
  }
  observe(target: unknown) {
    this.observed.push(target)
  }
  disconnect() {
    this.disconnected = true
  }
}

function reserve(height: number, padding?: string) {
  const banner = {
    height,
    getBoundingClientRect() {
      return { height: this.height }
    },
  }
  const style = fakeStyle(padding ? { "padding-bottom": padding } : {})
  const release = reserveSpace(banner as unknown as HTMLElement, { style } as unknown as HTMLElement)
  return { banner, style, release, observer: FakeResizeObserver.all[0]! }
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver)
})

afterEach(() => {
  FakeResizeObserver.all = []
  vi.unstubAllGlobals()
})

describe("reserveSpace", () => {
  it("publishes the height of the banner, rounded up, and pads the page by as much", () => {
    const { banner, style, observer } = reserve(55.4)
    expect(RESERVED_HEIGHT_VAR).toBe("--consent-h")
    expect(style.getPropertyValue("--consent-h")).toBe("56px")
    expect(style.getPropertyValue("padding-bottom")).toBe("var(--consent-h)")
    expect(observer.observed).toEqual([banner])
  })

  it("follows the banner when its size changes", () => {
    const { banner, style, observer } = reserve(56)
    banner.height = 78
    observer.notify()
    expect(style.getPropertyValue("--consent-h")).toBe("78px")
  })

  it("gives the room back when the banner goes away", () => {
    const { style, release, observer } = reserve(56)
    release()
    expect(style.getPropertyValue("--consent-h")).toBe("")
    expect(style.getPropertyValue("padding-bottom")).toBe("")
    expect(observer.disconnected).toBe(true)
  })

  it("puts back the padding the page had", () => {
    const { style, release } = reserve(56, "2rem")
    expect(style.getPropertyValue("padding-bottom")).toBe("var(--consent-h)")
    release()
    expect(style.getPropertyValue("padding-bottom")).toBe("2rem")
  })
})
