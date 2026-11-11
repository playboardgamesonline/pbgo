import { describe, expect, it } from "vitest"
// The table and the engine agree on where a cell is by the two numbers that place it: this is the one test that reads the kit, to check they do
import { hexBoard, squareBoard } from "../../../engine-kit/src/board"
import { type BoardCell, hexCells, inradius, squareCells, tileYaw } from "./cells"

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

describe("anchored cells", () => {
  const board = squareBoard({ columns: 3, rows: 3 })

  it("puts the anchor cell on `at`, and the others where the board puts them round it", () => {
    const cells = squareCells(board.coords, { size: 2, at: { x: 5, z: -3 }, anchor: [1, 1] })
    // The middle cell, 4, is the anchor
    expect([cells[4]!.x, cells[4]!.z]).toEqual([5, -3])
    expect([cells[0]!.x, cells[0]!.z]).toEqual([3, -5])
    expect([cells[8]!.x, cells[8]!.z]).toEqual([7, -1])
  })

  it("leaves the cells where they were when others are added, which centring does not", () => {
    const [first, second] = [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
      ],
    ] as const
    const [few, many] = [squareCells(first, { size: 1, anchor: [0, 0] }), squareCells(second, { size: 1, anchor: [0, 0] })]
    expect([few[1]!.x, few[1]!.z]).toEqual([many[1]!.x, many[1]!.z])
    expect([few[0]!.x, few[0]!.z]).toEqual([0, 0])
    // Centred, the same cell moves
    const [centredFew, centredMany] = [squareCells(first, { size: 1 }), squareCells(second, { size: 1 })]
    expect(centredFew[1]!.x).not.toBe(centredMany[1]!.x)
  })

  it("does not need the anchor to be one of the cells", () => {
    const cells = squareCells([[2, 3]], { size: 2, anchor: [0, 0] })
    expect([cells[0]!.x, cells[0]!.z]).toEqual([4, 6])
  })

  it("anchors hexagons the same way: the anchor on `at`, neighbours one size from it", () => {
    const hexes = hexBoard({ radius: 2 })
    const cells = hexCells(hexes.coords, { size: 2, at: { x: 1, z: 1 }, anchor: [0, 0] })
    const middle = hexes.at(0, 0)
    expect([cells[middle]!.x, cells[middle]!.z]).toEqual([1, 1])
    for (const next of hexes.neighbours(middle)) expect(apart(cells[middle]!, cells[next]!)).toBeCloseTo(2, 12)
    const [one, other] = [hexCells([[1, 2]], { size: 1, anchor: [0, 0] }), hexCells([[1, 2], [3, 3]], { size: 1, anchor: [0, 0] })]
    expect([one[0]!.x, one[0]!.z]).toEqual([other[0]!.x, other[0]!.z])
  })

  it("refuses an anchor that is not a cell", () => {
    expect(() => squareCells([[0, 0]], { size: 1, anchor: [0] as never })).toThrow(RangeError)
    expect(() => hexCells([[0, 0]], { size: 1, anchor: [Number.NaN, 0] })).toThrow(RangeError)
  })
})

describe("tileYaw", () => {
  it("is a quarter of a circle for a turn of a square tile, clockwise, which is a negative yaw", () => {
    expect(tileYaw(0)).toBeCloseTo(0, 12)
    expect(tileYaw(1)).toBeCloseTo(-Math.PI / 2, 12)
    expect(tileYaw(2)).toBeCloseTo(-Math.PI, 12)
    expect(tileYaw(4)).toBeCloseTo(-2 * Math.PI, 12)
    expect(tileYaw(-1)).toBeCloseTo(Math.PI / 2, 12)
  })

  it("is a sixth of a circle for a turn of a hexagonal tile", () => {
    expect(tileYaw(1, 6)).toBeCloseTo(-Math.PI / 3, 12)
    expect(tileYaw(3, 6)).toBeCloseTo(-Math.PI, 12)
  })

  it("turns a tile so that its east goes to the south, as the engine says a tile turned once shows on its south what it had on its east", () => {
    // A Piece turned by `yaw` about the vertical maps its local +x to (cos yaw, -sin yaw) on the table (x to the right, z toward the viewer)
    const yaw = tileYaw(1)
    const east = [Math.cos(yaw), -Math.sin(yaw)]
    expect(east[0]).toBeCloseTo(0, 12)
    expect(east[1]).toBeCloseTo(1, 12)
  })

  it("refuses what is not a turn or a tile", () => {
    expect(() => tileYaw(0.5)).toThrow(RangeError)
    expect(() => tileYaw(1, 2)).toThrow(RangeError)
    expect(() => tileYaw(1, 4.5)).toThrow(RangeError)
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
