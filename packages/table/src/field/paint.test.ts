import { describe, expect, it } from "vitest"
import type { Box, SheetLayout } from "./layout"
import { baselineOf, innerBox, paintSheet, type SheetLook, type SheetStyle } from "./paint"

/** What a canvas context was asked to do, in order, with the state it was in */
function fakeContext() {
  const calls: string[] = []
  const g = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    clearRect: (...a: number[]) => calls.push(`clearRect ${a.join(",")}`),
    beginPath: () => calls.push("beginPath"),
    roundRect: (...a: number[]) => calls.push(`roundRect ${a.map((n) => n.toFixed(1)).join(",")}`),
    fill: () => calls.push(`fill ${g.fillStyle}`),
    stroke: () => calls.push(`stroke ${g.strokeStyle} ${g.lineWidth}`),
    fillRect: (...a: number[]) => calls.push(`fillRect ${g.globalAlpha} ${a.join(",")}`),
    rect: (...a: number[]) => calls.push(`rect ${a.join(",")}`),
    clip: () => calls.push("clip"),
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText ${text} ${x},${y} ${g.font} ${g.fillStyle} ${g.globalAlpha}`),
  }
  return { calls, g: g as unknown as CanvasRenderingContext2D }
}

const STYLE: SheetStyle = { paper: "#eee", ink: "#111", accent: "#d90", font: "Test Sans", weight: 600 }
const LOOK: SheetLook = { focused: false, disabled: false, faint: false }
const BOX: Box = { width: 400, height: 100, lines: 1 }
const layout = (rows: string[], pitch = 100): SheetLayout => ({ size: 68, pitch, rows: rows.map((text, i) => ({ text, start: i * 10 })), cut: false })

describe("innerBox", () => {
  it("leaves a margin all round, in proportion to the height of a line", () => {
    const { pad, inner } = innerBox(BOX)
    expect(pad).toBe(16)
    expect(inner).toEqual({ width: 368, height: 68, lines: 1 })
    expect(innerBox({ width: 400, height: 200, lines: 2 }).pad).toBe(16)
  })
})

describe("paintSheet", () => {
  it("clears the canvas, then paints the paper with rounded corners", () => {
    const { calls, g } = fakeContext()
    paintSheet(g, BOX, layout(["hello"]), STYLE, LOOK)
    expect(calls[0]).toBe("clearRect 0,0,400,100")
    expect(calls.slice(1, 4)).toEqual(["beginPath", "roundRect 0.0,0.0,400.0,100.0,9.0", "fill #eee"])
  })

  it("draws its edge in the accent while the player writes, and quietly otherwise", () => {
    const quiet = fakeContext()
    paintSheet(quiet.g, BOX, layout(["a"]), STYLE, LOOK)
    expect(quiet.calls.find((c) => c.startsWith("stroke"))).toBe("stroke rgba(0, 0, 0, 0.16) 3")
    const writing = fakeContext()
    paintSheet(writing.g, BOX, layout(["a"]), STYLE, { ...LOOK, focused: true })
    expect(writing.calls.find((c) => c.startsWith("stroke"))).toBe("stroke #d90 6")
  })

  it("rules a faint line under each line of the sheet", () => {
    const { calls, g } = fakeContext()
    paintSheet(g, { width: 400, height: 200, lines: 2 }, layout(["a"], 100), STYLE, LOOK)
    const rules = calls.filter((c) => c.startsWith("fillRect"))
    expect(rules).toHaveLength(2)
    expect(rules[0]).toMatch(/^fillRect 0\.14 16,/)
  })

  it("writes each row at the margin, on its own baseline, in the ink and the font", () => {
    const { calls, g } = fakeContext()
    paintSheet(g, { width: 400, height: 200, lines: 2 }, layout(["first", "second"], 100), STYLE, LOOK)
    const texts = calls.filter((c) => c.startsWith("fillText"))
    expect(texts).toEqual([`fillText first 16,${baselineOf(0, 16, 100)} 600 68px Test Sans #111 1`, `fillText second 16,${baselineOf(1, 16, 100)} 600 68px Test Sans #111 1`])
  })

  it("keeps the writing inside the paper: it is clipped to the margins", () => {
    const { calls, g } = fakeContext()
    paintSheet(g, BOX, layout(["x".repeat(200)]), STYLE, LOOK)
    expect(calls).toContain("rect 16,0,368,100")
    expect(calls.indexOf("clip")).toBeLessThan(calls.findIndex((c) => c.startsWith("fillText")))
    expect(calls.at(-1)).toBe("restore")
  })

  it("dims the ink of a sheet nobody can write on, and fades the sentence that tells what to write", () => {
    const disabled = fakeContext()
    paintSheet(disabled.g, BOX, layout(["a"]), STYLE, { ...LOOK, disabled: true })
    expect(disabled.calls.find((c) => c.startsWith("fillText"))).toMatch(/ 0\.5$/)
    const faint = fakeContext()
    paintSheet(faint.g, BOX, layout(["Write a clue"]), STYLE, { ...LOOK, faint: true })
    expect(faint.calls.find((c) => c.startsWith("fillText"))).toMatch(/ 0\.4$/)
  })

  it("paints an empty sheet as paper and rules, with an empty row of text", () => {
    const { calls, g } = fakeContext()
    paintSheet(g, BOX, layout([""]), STYLE, LOOK)
    expect(calls.find((c) => c.startsWith("fillText"))).toContain("fillText  16,")
  })
})
