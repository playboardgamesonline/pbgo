import { describe, expect, it } from "vitest"
import { cellAt, gridCells } from "./cells"

describe("gridCells", () => {
  it("cuts the whole sheet into cells row by row from the top left", () => {
    const cells = gridCells({ columns: 2, rows: 3 })
    expect(cells).toHaveLength(6)
    expect(cells[0]).toEqual({ x: 0, y: 0, width: 0.5, height: 1 / 3 })
    // The cell at column 1 and row 2 is 2 * 2 + 1
    expect(cells[5]!.x).toBeCloseTo(0.5, 12)
    expect(cells[5]!.y).toBeCloseTo(2 / 3, 12)
  })

  it("fills the rectangle it is given", () => {
    const cells = gridCells({ columns: 1, rows: 4, x: 0.6, y: 0.1, width: 0.3, height: 0.8 })
    expect(cells.map((cell) => cell.x)).toEqual([0.6, 0.6, 0.6, 0.6])
    expect(cells[3]!.y).toBeCloseTo(0.1 + 0.6, 12)
    expect(cells[0]!.width).toBeCloseTo(0.3, 12)
    expect(cells[0]!.height).toBeCloseTo(0.2, 12)
  })

  it("leaves room between the cells, none after the last", () => {
    const cells = gridCells({ columns: 3, rows: 1, gapX: 0.05 })
    expect(cells[0]!.width).toBeCloseTo(0.3, 12)
    expect(cells[1]!.x).toBeCloseTo(0.35, 12)
    expect(cells[2]!.x + cells[2]!.width).toBeCloseTo(1, 12)
  })

  it("refuses what is not a grid", () => {
    expect(() => gridCells({ columns: 0, rows: 2 })).toThrow(RangeError)
    expect(() => gridCells({ columns: 2, rows: 1.5 })).toThrow(RangeError)
    expect(() => gridCells({ columns: 2, rows: 2, width: 0 })).toThrow(RangeError)
    expect(() => gridCells({ columns: 2, rows: 2, gapX: -0.1 })).toThrow(RangeError)
    expect(() => gridCells({ columns: 2, rows: 2, gapX: 1 })).toThrow(RangeError)
  })
})

describe("cellAt", () => {
  const cells = gridCells({ columns: 2, rows: 2, gapX: 0.1, gapY: 0.1 })

  it("finds the cell that holds a place of the sheet", () => {
    expect(cellAt(cells, 0.1, 0.1)).toBe(0)
    expect(cellAt(cells, 0.9, 0.1)).toBe(1)
    expect(cellAt(cells, 0.1, 0.9)).toBe(2)
    expect(cellAt(cells, 0.9, 0.9)).toBe(3)
  })

  it("is -1 on the paper between the cells and outside the sheet", () => {
    expect(cellAt(cells, 0.5, 0.5)).toBe(-1)
    expect(cellAt(cells, -0.1, 0.1)).toBe(-1)
    expect(cellAt(cells, 1.2, 0.1)).toBe(-1)
  })

  it("lets a cell hold its edges, the first of two cells that meet taking the place", () => {
    const touching = gridCells({ columns: 2, rows: 1 })
    expect(cellAt(touching, 0, 0)).toBe(0)
    expect(cellAt(touching, 0.5, 0.5)).toBe(0)
    expect(cellAt(touching, 1, 1)).toBe(1)
  })

  it("is -1 for a sheet with no cell", () => {
    expect(cellAt([], 0.5, 0.5)).toBe(-1)
  })
})
