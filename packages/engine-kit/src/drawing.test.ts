import { describe, expect, it } from "vitest"
import { addStrokes, cleanDrawing, cleanStroke, DRAWING_GRID, DRAWING_LIMITS, drawingPoints, emptyDrawing, type Stroke, undoStroke } from "./drawing"
import { EngineError, isSharedErrorCode } from "./errors"

const RULES = { colors: 4, widths: 3 }
const stroke = (points: number[], color = 0, width = 0): Stroke => ({ color, width, points })
const refusal = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    if (error instanceof EngineError) return error.code
    throw error
  }
  return null
}
/** A stroke of `n` points on a line */
const line = (n: number) => Array.from({ length: n * 2 }, (_, i) => (i % 2 === 0 ? i / 2 : 5))

describe("the codes of a drawing", () => {
  it("are shared, so that the platform words them", () => {
    expect(isSharedErrorCode("INVALID_DRAWING")).toBe(true)
    expect(isSharedErrorCode("DRAWING_FULL")).toBe(true)
  })
})

describe("cleanStroke", () => {
  it("gives back the stroke as a new object with its three fields and nothing else", () => {
    const input = { color: 2, width: 1, points: [10, 20, 30, 40], extra: "x" }
    const cleaned = cleanStroke(input, RULES)
    expect(cleaned).toEqual({ color: 2, width: 1, points: [10, 20, 30, 40] })
    expect(cleaned).not.toBe(input)
    expect(cleaned.points).not.toBe(input.points)
  })

  it("takes the corners of the sheet and a dot", () => {
    expect(cleanStroke(stroke([0, 0, DRAWING_GRID, DRAWING_GRID]), RULES).points).toEqual([0, 0, DRAWING_GRID, DRAWING_GRID])
    expect(cleanStroke(stroke([500, 500]), RULES).points).toEqual([500, 500])
  })

  it("rounds a point that is not whole, as a board that works in pixels sends it", () => {
    expect(cleanStroke(stroke([10.4, 20.6, 30.5, 40]), RULES).points).toEqual([10, 21, 31, 40])
    expect(cleanStroke(stroke([-0.4, 1000.4]), RULES).points).toEqual([0, 1000])
  })

  it("keeps a point once when it comes twice in a row, and the same point when something is between", () => {
    expect(cleanStroke(stroke([5, 5, 5, 5, 5.2, 4.9, 9, 9]), RULES).points).toEqual([5, 5, 9, 9])
    expect(cleanStroke(stroke([5, 5, 9, 9, 5, 5]), RULES).points).toEqual([5, 5, 9, 9, 5, 5])
  })

  it("refuses what is not a stroke", () => {
    for (const input of [null, undefined, 0, "stroke", true, [], [1, 2], () => 1]) expect(refusal(() => cleanStroke(input, RULES)), String(input)).toBe("INVALID_DRAWING")
  })

  it("refuses a colour or a width that the palette does not have", () => {
    for (const color of [4, -1, 1.5, Number.NaN, Infinity, "1", null, undefined]) expect(refusal(() => cleanStroke({ color, width: 0, points: [1, 1] }, RULES)), String(color)).toBe("INVALID_DRAWING")
    for (const width of [3, -1, 0.5, Number.NaN, "0", null, undefined]) expect(refusal(() => cleanStroke({ color: 0, width, points: [1, 1] }, RULES)), String(width)).toBe("INVALID_DRAWING")
  })

  it("refuses points that are not pairs of numbers on the sheet", () => {
    for (const points of [undefined, null, "12", {}, [], [1], [1, 2, 3], [1, "2"], [1, Number.NaN], [Infinity, 1], [1, null], [-1, 5], [5, 1001], [1001, 5], [5, -1]]) {
      expect(refusal(() => cleanStroke({ color: 0, width: 0, points }, RULES)), JSON.stringify(points)).toBe("INVALID_DRAWING")
    }
  })

  it("refuses a stroke with more points than the game allows, and takes one with exactly that many", () => {
    expect(cleanStroke(stroke(line(DRAWING_LIMITS.strokePoints)), RULES).points).toHaveLength(DRAWING_LIMITS.strokePoints * 2)
    expect(refusal(() => cleanStroke(stroke(line(DRAWING_LIMITS.strokePoints + 1)), RULES))).toBe("INVALID_DRAWING")
    expect(refusal(() => cleanStroke(stroke(line(6)), { ...RULES, strokePoints: 5 }))).toBe("INVALID_DRAWING")
    expect(cleanStroke(stroke(line(5)), { ...RULES, strokePoints: 5 }).points).toHaveLength(10)
  })

  it("counts the points as they are sent, so that a request cannot make the engine walk a million of them", () => {
    // Eight points that are four places, over a limit of four: a board takes its own repeats out before it sends them
    expect(refusal(() => cleanStroke(stroke([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]), { ...RULES, strokePoints: 4 }))).toBe("INVALID_DRAWING")
    expect(cleanStroke(stroke([1, 1, 2, 2, 3, 3, 4, 4]), { ...RULES, strokePoints: 4 }).points).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })

  it("is a bug of the game, and no move of a player, when the rules are no numbers of the kind", () => {
    for (const rules of [{ colors: 0, widths: 3 }, { colors: 4, widths: 0 }, { colors: 1.5, widths: 3 }, { colors: 4, widths: 3, strokes: 0 }, { colors: 4, widths: 3, points: -1 }, { colors: 4, widths: 3, strokePoints: Number.NaN }]) {
      expect(() => cleanStroke(stroke([1, 1]), rules)).toThrow(RangeError)
    }
  })
})

describe("addStrokes", () => {
  it("adds the strokes in the order they come and leaves the drawing it is given alone", () => {
    const first: Stroke[] = [stroke([1, 1, 2, 2])]
    const drawn = addStrokes(first, [stroke([3, 3], 1), stroke([4, 4, 5, 5], 2, 1)], RULES)
    expect(drawn).toEqual([stroke([1, 1, 2, 2]), stroke([3, 3], 1), stroke([4, 4, 5, 5], 2, 1)])
    expect(first).toEqual([stroke([1, 1, 2, 2])])
    expect(drawn).not.toBe(first)
  })

  it("refuses what is not a list of strokes, or an empty list", () => {
    for (const input of [undefined, null, {}, "strokes", stroke([1, 1]), []]) expect(refusal(() => addStrokes(emptyDrawing(), input, RULES)), JSON.stringify(input)).toBe("INVALID_DRAWING")
  })

  it("refuses the whole batch when one of its strokes is not one", () => {
    const first = [stroke([1, 1])]
    expect(refusal(() => addStrokes(first, [stroke([2, 2]), { color: 9, width: 0, points: [1, 1] }], RULES))).toBe("INVALID_DRAWING")
    expect(first).toEqual([stroke([1, 1])])
  })

  it("says the sheet is full when there would be more strokes than it holds, which is no fault of the stroke", () => {
    const limit = { ...RULES, strokes: 3 }
    const two = addStrokes([], [stroke([1, 1]), stroke([2, 2])], limit)
    expect(addStrokes(two, [stroke([3, 3])], limit)).toHaveLength(3)
    expect(refusal(() => addStrokes(two, [stroke([3, 3]), stroke([4, 4])], limit))).toBe("DRAWING_FULL")
    const full = addStrokes(two, [stroke([3, 3])], limit)
    expect(refusal(() => addStrokes(full, [stroke([4, 4])], limit))).toBe("DRAWING_FULL")
  })

  it("says the sheet is full when there would be more points than it holds", () => {
    const limit = { ...RULES, points: 10 }
    const six = addStrokes([], [stroke(line(6))], limit)
    expect(drawingPoints(six)).toBe(6)
    expect(drawingPoints(addStrokes(six, [stroke(line(4))], limit))).toBe(10)
    expect(refusal(() => addStrokes(six, [stroke(line(5))], limit))).toBe("DRAWING_FULL")
  })

  it("takes a stroke that is not fit before it says the sheet is full", () => {
    const limit = { ...RULES, strokes: 1 }
    const full = addStrokes([], [stroke([1, 1])], limit)
    expect(refusal(() => addStrokes(full, [{ color: 9, width: 0, points: [1, 1] }], limit))).toBe("INVALID_DRAWING")
  })
})

describe("cleanDrawing", () => {
  it("takes a drawing a player hands in, and an empty one", () => {
    expect(cleanDrawing([stroke([1, 1, 2, 2], 1, 2)], RULES)).toEqual([stroke([1, 1, 2, 2], 1, 2)])
    expect(cleanDrawing([], RULES)).toEqual([])
  })

  it("refuses what is not a drawing, and a drawing that passes the limits", () => {
    for (const input of [undefined, null, {}, "x", stroke([1, 1])]) expect(refusal(() => cleanDrawing(input, RULES)), JSON.stringify(input)).toBe("INVALID_DRAWING")
    expect(refusal(() => cleanDrawing([stroke([1, 1]), stroke([2, 2])], { ...RULES, strokes: 1 }))).toBe("DRAWING_FULL")
  })

  it("checks the rules even when nothing is drawn", () => {
    expect(() => cleanDrawing([], { colors: 0, widths: 3 })).toThrow(RangeError)
  })
})

describe("what a drawing is", () => {
  it("counts its points", () => {
    expect(drawingPoints([])).toBe(0)
    expect(drawingPoints([stroke([1, 1]), stroke([1, 1, 2, 2, 3, 3])])).toBe(4)
  })

  it("loses its last stroke when undone, and stays as it is when there is none", () => {
    const drawing = [stroke([1, 1]), stroke([2, 2])]
    expect(undoStroke(drawing)).toEqual([stroke([1, 1])])
    expect(drawing).toHaveLength(2)
    expect(undoStroke([])).toEqual([])
    expect(undoStroke(undoStroke(undoStroke(drawing)))).toEqual([])
  })

  it("is plain data, the same after it has been stored as jsonb", () => {
    const drawing = addStrokes([], [stroke([1, 1, 500, 500, 1000, 0], 3, 2), stroke([7, 7])], RULES)
    expect(JSON.parse(JSON.stringify(drawing))).toEqual(drawing)
  })

  it("keeps to a size a table can carry: a drawing at the limits is about twenty kilobytes", () => {
    let drawing = emptyDrawing()
    const pieces = Array.from({ length: DRAWING_LIMITS.strokes }, () => stroke(line(Math.floor(DRAWING_LIMITS.points / DRAWING_LIMITS.strokes))))
    drawing = addStrokes(drawing, pieces, RULES)
    expect(drawingPoints(drawing)).toBeLessThanOrEqual(DRAWING_LIMITS.points)
    expect(JSON.stringify(drawing).length).toBeLessThan(30_000)
  })
})
