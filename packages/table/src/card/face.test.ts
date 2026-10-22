import { SRGBColorSpace } from "three"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { faceResolution, paintFace, standIn } from "./face"

/** What a canvas context was asked to do, in order. Text is measured at 0.6 of its font size per character */
function fakeCanvas() {
  const calls: string[] = []
  const ctx = {
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    fillRect: (x: number, y: number, w: number, h: number) => calls.push(`fillRect ${ctx.fillStyle} ${x},${y},${w},${h}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText ${text} ${x},${y} ${ctx.font}`),
    measureText: (text: string) => ({ width: text.length * Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? "10") * 0.6 }),
  }
  const canvas = { width: 0, height: 0, getContext: () => ctx }
  return { calls, canvas }
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

describe("faceResolution", () => {
  it("is 360 pixels across and as high as the card's proportions ask", () => {
    expect(faceResolution({ width: 1.3, height: 1.9 })).toEqual({ width: 360, height: 526 })
    expect(faceResolution({ width: 1, height: 1 })).toEqual({ width: 360, height: 360 })
    expect(faceResolution({ width: 2, height: 1 })).toEqual({ width: 360, height: 180 })
  })

  it("takes the width the game asks for", () => {
    expect(faceResolution({ width: 1.3, height: 1.9 }, 720)).toEqual({ width: 720, height: 1052 })
  })
})

describe("paintFace", () => {
  it("paints the whole rectangle at the face's resolution, in sRGB", () => {
    const draw = vi.fn()
    const texture = paintFace("face:resolution", { width: 1.3, height: 1.9 }, draw)
    expect(canvases).toHaveLength(1)
    expect(canvases[0]!.canvas).toMatchObject({ width: 360, height: 526 })
    expect(draw).toHaveBeenCalledOnce()
    expect(draw.mock.calls[0]!.slice(1)).toEqual([360, 526])
    expect(texture.colorSpace).toBe(SRGBColorSpace)
    expect(texture.anisotropy).toBe(8)
  })

  it("paints a key once at a size: asking again gives back the same texture", () => {
    const draw = vi.fn()
    const size = { width: 1.3, height: 1.9 }
    const texture = paintFace("face:same", size, draw)
    expect(paintFace("face:same", size, draw)).toBe(texture)
    expect(draw).toHaveBeenCalledOnce()
  })

  it("paints again for another key, another size or another resolution", () => {
    const draw = vi.fn()
    const size = { width: 1.3, height: 1.9 }
    const texture = paintFace("face:other", size, draw)
    expect(paintFace("face:other-key", size, draw)).not.toBe(texture)
    expect(paintFace("face:other", { width: 1.4, height: 1.9 }, draw)).not.toBe(texture)
    expect(paintFace("face:other", size, draw, 720)).not.toBe(texture)
    expect(draw).toHaveBeenCalledTimes(4)
  })
})

describe("standIn", () => {
  const size = { width: 1.3, height: 1.9 }

  it("fills the whole face with a neutral paper unless told another colour", () => {
    standIn("plain", size)
    expect(canvases[0]!.calls).toEqual(["fillRect #d8d2c2 0,0,360,526"])
    standIn("plain-red", size, { color: "#aa3322" })
    expect(canvases[1]!.calls).toEqual(["fillRect #aa3322 0,0,360,526"])
  })

  it("writes the label across the middle, so a missing picture shows its key", () => {
    standIn("short", size, { label: "ok" })
    expect(canvases[0]!.calls).toEqual(["fillRect #d8d2c2 0,0,360,526", "fillText ok 180,263 700 36px system-ui, sans-serif"])
  })

  it("shrinks a long label to fit the card", () => {
    const label = "[missing: cardBack]"
    standIn("long", size, { label })
    const written = canvases[0]!.calls.find((call) => call.startsWith("fillText"))!
    const font = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(written)![1]!)
    expect(font).toBeLessThan(36)
    expect(label.length * font * 0.6).toBeCloseTo(360 * 0.86, 6)
  })

  it("is the same texture for the same key, colour and label", () => {
    const texture = standIn("same", size, { label: "x" })
    expect(standIn("same", size, { label: "x" })).toBe(texture)
    expect(standIn("same", size, { label: "y" })).not.toBe(texture)
    expect(standIn("same", size, { label: "x", color: "#000000" })).not.toBe(texture)
  })
})
