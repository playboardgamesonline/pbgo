import { describe, expect, it } from "vitest"
// The table and the engine agree on where a cell is by the two numbers that place it: this is the one test that reads the kit, to check they do
import { hexBoard, squareBoard } from "../../../engine-kit/src/board"
import { type BoardCell, hexCells, inradius, squareCells } from "./cells"

const apart = (a: BoardCell, b: BoardCell) => Math.hypot(a.x - b.x, a.z - b.z)

describe("squareCells", () => {
  const board = squareBoard({ columns: 4, rows: 3 })
  const cells = squareCells(board.coords, { size: 2 })

  it("makes a cell for each of the coordinates, in their order", () => {
    expect(cells).toHaveLength(12)
  })

  it("puts a column toward the right and a row toward the viewer, so the first row is the farthest", () => {
    expect(cells[1]!.x - cells[0]!.x).toBe(2)
    expect(cells[1]!.z).toBe(cells[0]!.z)
    expect(cells[4]!.z - cells[0]!.z).toBe(2)
    expect(cells[4]!.x).toBe(cells[0]!.x)
    expect(cells[0]!.z).toBeLessThan(cells[11]!.z)
  })

  it("centres the board on the middle of the table, or where it is told to", () => {
    expect(cells.reduce((sum, cell) => sum + cell.x, 0)).toBeCloseTo(0, 12)
    expect(cells.reduce((sum, cell) => sum + cell.z, 0)).toBeCloseTo(0, 12)
    const moved = squareCells(board.coords, { size: 2, at: { x: 5, z: -3 } })
    expect(moved.reduce((sum, cell) => sum + cell.x, 0) / 12).toBeCloseTo(5, 12)
    expect(moved.reduce((sum, cell) => sum + cell.z, 0) / 12).toBeCloseTo(-3, 12)
  })

  it("draws a cell as a square of the size of the board, its corners clockwise from the far left", () => {
    expect(cells[0]!.corners).toEqual([
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
    expect(inradius(cells[0]!)).toBe(1)
  })

  it("leaves a gap between two cells by drawing each of them smaller", () => {
    const gapped = squareCells(board.coords, { size: 2, gap: 0.2 })
    expect(gapped[0]!.corners[1]).toEqual([0.9, -0.9])
    expect(apart(gapped[0]!, gapped[1]!)).toBe(2)
  })

  it("faces every cell the same way", () => {
    expect(cells.every((cell) => cell.yaw === 0)).toBe(true)
  })

  it("makes only the cells it is given: a board with holes, or one that grows", () => {
    const some = squareCells(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      { size: 1 },
    )
    expect(some).toHaveLength(3)
    expect(squareCells([], { size: 1 })).toEqual([])
  })

  it("refuses a size that is not above zero and a gap that is not less than it", () => {
    for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => squareCells(board.coords, { size }), String(size)).toThrow(RangeError)
    for (const gap of [-0.1, 2, 3, Number.NaN]) expect(() => squareCells(board.coords, { size: 2, gap }), String(gap)).toThrow(RangeError)
  })
})

describe("hexCells", () => {
  const board = hexBoard({ radius: 2 })
  const cells = hexCells(board.coords, { size: 2 })

  it("makes a cell for each of the coordinates, in their order", () => {
    expect(cells).toHaveLength(19)
  })

  it("puts neighbours one size apart, whichever the way: that is what the engine means by next to", () => {
    for (const grid of [board, hexBoard({ radius: 3 }), hexBoard({ columns: 5, rows: 4 })]) {
      const placed = hexCells(grid.coords, { size: 2 })
      for (let cell = 0; cell < grid.size; cell++) for (const next of grid.neighbours(cell)) expect(apart(placed[cell]!, placed[next]!)).toBeCloseTo(2, 9)
    }
  })

  it("puts cells that are not neighbours further than that", () => {
    for (let cell = 0; cell < board.size; cell++) {
      for (let other = 0; other < board.size; other++) {
        if (cell === other || board.neighbours(cell).includes(other)) continue
        expect(apart(cells[cell]!, cells[other]!)).toBeGreaterThan(2 + 1e-9)
      }
    }
  })

  it("puts the rows of a rectangle half a cell from one another, the odd ones to the right", () => {
    const grid = hexBoard({ columns: 4, rows: 3 })
    const placed = hexCells(grid.coords, { size: 2 })
    expect(placed[4]!.x - placed[0]!.x).toBeCloseTo(1, 9)
    expect(placed[8]!.x).toBeCloseTo(placed[0]!.x, 9)
    expect(placed[4]!.z - placed[0]!.z).toBeCloseTo(Math.sqrt(3), 9)
  })

  it("puts a row toward the viewer and the first row the farthest, the middle cell of a hexagon at the middle", () => {
    expect(cells[0]!.z).toBeLessThan(cells[18]!.z)
    expect(cells[9]!.x).toBeCloseTo(0, 12)
    expect(cells[9]!.z).toBeCloseTo(0, 12)
  })

  it("draws a cell as a hexagon with a point up, its corners clockwise from the far point", () => {
    const radius = 2 / Math.sqrt(3)
    const corners = cells[0]!.corners
    expect(corners).toHaveLength(6)
    expect(corners[0]![0]).toBeCloseTo(0, 12)
    expect(corners[0]![1]).toBeCloseTo(-radius, 12)
    for (const [x, z] of corners) expect(Math.hypot(x, z)).toBeCloseTo(radius, 12)
    // The second corner is up and to the right
    expect(corners[1]![0]).toBeGreaterThan(0)
    expect(corners[1]![1]).toBeLessThan(0)
    // The corner after that is down and to the right
    expect(corners[2]![1]).toBeGreaterThan(0)
  })

  it("fits the cells edge to edge when there is no gap: a cell is as wide as the distance between two middles", () => {
    expect(inradius(cells[0]!)).toBeCloseTo(1, 12)
  })

  it("leaves a gap by drawing each cell smaller", () => {
    const gapped = hexCells(board.coords, { size: 2, gap: 0.2 })
    expect(inradius(gapped[0]!)).toBeCloseTo(0.9, 12)
    expect(apart(gapped[0]!, gapped[1]!)).toBeCloseTo(2, 9)
  })

  it("refuses a size that is not above zero and a gap that is not less than it", () => {
    expect(() => hexCells(board.coords, { size: 0 })).toThrow(RangeError)
    expect(() => hexCells(board.coords, { size: 1, gap: 1 })).toThrow(RangeError)
  })
})

describe("inradius", () => {
  it("is the largest circle that fits in the cell", () => {
    expect(inradius({ x: 0, z: 0, yaw: 0, corners: [] })).toBe(0)
    expect(
      inradius({
        x: 0,
        z: 0,
        yaw: 0,
        corners: [
          [-2, -1],
          [2, -1],
          [2, 1],
          [-2, 1],
        ],
      }),
    ).toBe(1)
  })
})
