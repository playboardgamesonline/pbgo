import { SRGBColorSpace } from "three"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_BODY, DEFAULT_INK, pipFace } from "./pips"

/** What a canvas context was asked to do, in order */
function fakeCanvas() {
  const calls: string[] = []
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    fillRect: (x: number, y: number, w: number, h: number) => calls.push(`fillRect ${ctx.fillStyle} ${x},${y},${w},${h}`),
    beginPath: () => calls.push("beginPath"),
    arc: (x: number, y: number) => calls.push(`arc ${x.toFixed(1)},${y.toFixed(1)}`),
    fill: () => calls.push(`fill ${ctx.fillStyle}`),
    stroke: () => calls.push("stroke"),
  }
  return { calls, canvas: { width: 0, height: 0, getContext: () => ctx } }
}

let canvases: ReturnType<typeof fakeCanvas>[]

beforeEach(() => {
  canvases = []
  vi.stubGlobal("document", {
    createElement: () => {
      const made = fakeCanvas()
      canvases.push(made)
      return made.canvas
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("pipFace", () => {
  it("paints a square face, in sRGB, with the body colour all over it", () => {
    const texture = pipFace(2)
    expect(canvases).toHaveLength(1)
    expect(canvases[0]!.canvas).toMatchObject({ width: 256, height: 256 })
    expect(canvases[0]!.calls[0]).toBe(`fillRect ${DEFAULT_BODY} 0,0,256,256`)
    expect(texture.colorSpace).toBe(SRGBColorSpace)
  })

  it("paints as many pips as the value, each in the pip colour", () => {
    for (const value of [1, 2, 3, 4, 5, 6]) {
      const before = canvases.length
      pipFace(value, { body: "#ffffff", ink: `#00000${value}` })
      const made = canvases[before]!
      expect(made.calls.filter((call) => call.startsWith("fill #00000"))).toHaveLength(value)
      expect(made.calls.filter((call) => call.startsWith("arc"))).toHaveLength(value * 2)
    }
  })

  it("puts a single pip in the middle", () => {
    pipFace(1, { body: "#eeeeee", ink: "#111111" })
    expect(canvases.at(-1)!.calls.filter((call) => call.startsWith("arc"))[0]).toBe("arc 128.0,128.0")
  })

  it("paints a face once: the same value in the same colours is the same texture", () => {
    const a = pipFace(5, { body: "#abcdef", ink: "#123456" })
    const count = canvases.length
    const b = pipFace(5, { body: "#abcdef", ink: "#123456" })
    expect(b).toBe(a)
    expect(canvases).toHaveLength(count)
    expect(pipFace(5, { body: "#abcdef", ink: "#654321" })).not.toBe(a)
    expect(pipFace(4, { body: "#abcdef", ink: "#123456" })).not.toBe(a)
  })

  it("has default colours", () => {
    expect(DEFAULT_INK).not.toBe(DEFAULT_BODY)
  })
})
