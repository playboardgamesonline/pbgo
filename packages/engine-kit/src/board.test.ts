import { describe, expect, it } from "vitest"
import { type Board, hexBoard, lineBetween, rayFrom, reachable, regionOf, shortestPath, squareBoard } from "./board"
import { createRng } from "./rng"

/** The cell of a board by the two numbers that place it, which the tests have to find: a mistake here would be a mistake of the test */
const at = (board: Board, a: number, b: number) => {
  const cell = board.at(a, b)
  if (cell < 0) throw new Error(`no cell at ${a}, ${b}`)
  return cell
}
const sorted = (cells: number[]) => [...cells].sort((a, b) => a - b)

describe("squareBoard", () => {
  const chess = squareBoard({ columns: 8, rows: 8 })

  it("numbers the cells row by row from the top left", () => {
    expect(chess.size).toBe(64)
    expect(chess.coords[0]).toEqual([0, 0])
    expect(chess.coords[7]).toEqual([7, 0])
    expect(chess.coords[8]).toEqual([0, 1])
    expect(chess.coords[63]).toEqual([7, 7])
    for (let cell = 0; cell < chess.size; cell++) expect(chess.at(...chess.coords[cell]!)).toBe(cell)
  })

  it("has a cell at the two numbers of every cell and none anywhere else", () => {
    for (const [a, b] of [
      [-1, 0],
      [0, -1],
      [8, 0],
      [0, 8],
      [1.5, 2],
      [Number.NaN, 0],
      [Number.POSITIVE_INFINITY, 1],
    ] as const)
      expect(chess.at(a, b), `${a}, ${b}`).toBe(-1)
  })

  it("is not necessarily a square: columns and rows are its own", () => {
    const wide = squareBoard({ columns: 5, rows: 2 })
    expect(wide.size).toBe(10)
    expect(wide.at(4, 1)).toBe(9)
    expect(wide.at(0, 2)).toBe(-1)
  })

  it("steps along the sides: east and south go toward the right and the viewer", () => {
    const middle = at(chess, 3, 3)
    expect(chess.directions).toBe(4)
    expect(chess.coords[chess.step(middle, 0)]).toEqual([4, 3])
    expect(chess.coords[chess.step(middle, 1)]).toEqual([3, 4])
    expect(chess.coords[chess.step(middle, 2)]).toEqual([2, 3])
    expect(chess.coords[chess.step(middle, 3)]).toEqual([3, 2])
  })

  it("steps along the corners as well when the game says so, the even directions being the sides", () => {
    const king = squareBoard({ columns: 8, rows: 8, diagonals: true })
    const middle = at(king, 3, 3)
    expect(king.directions).toBe(8)
    expect([0, 2, 4, 6].map((direction) => king.coords[king.step(middle, direction)])).toEqual([
      [4, 3],
      [3, 4],
      [2, 3],
      [3, 2],
    ])
    expect([1, 3, 5, 7].map((direction) => king.coords[king.step(middle, direction)])).toEqual([
      [4, 4],
      [2, 4],
      [2, 2],
      [4, 2],
    ])
  })

  it("steps off the board to nothing", () => {
    expect(chess.step(0, 2)).toBe(-1)
    expect(chess.step(0, 3)).toBe(-1)
    expect(chess.step(63, 0)).toBe(-1)
    expect(chess.step(63, 1)).toBe(-1)
  })

  it("has four neighbours in the middle, three on an edge and two in a corner, and eight, five and three with the corners", () => {
    expect([chess.neighbours(at(chess, 3, 3)), chess.neighbours(at(chess, 3, 0)), chess.neighbours(0)].map((cells) => cells.length)).toEqual([4, 3, 2])
    const king = squareBoard({ columns: 8, rows: 8, diagonals: true })
    expect([king.neighbours(at(king, 3, 3)), king.neighbours(at(king, 3, 0)), king.neighbours(0)].map((cells) => cells.length)).toEqual([8, 5, 3])
  })

  it("lists the neighbours in the order of the directions", () => {
    const middle = at(chess, 3, 3)
    expect(chess.neighbours(middle)).toEqual([0, 1, 2, 3].map((direction) => chess.step(middle, direction)))
  })

  it("makes every neighbour mutual", () => {
    for (const board of [chess, squareBoard({ columns: 5, rows: 4, diagonals: true })]) {
      for (let cell = 0; cell < board.size; cell++) for (const next of board.neighbours(cell)) expect(board.neighbours(next)).toContain(cell)
    }
  })

  it("counts the distance in steps of the sides, or of the king", () => {
    const [a, b] = [at(chess, 1, 1), at(chess, 4, 5)]
    expect(chess.distance(a, b)).toBe(7)
    expect(squareBoard({ columns: 8, rows: 8, diagonals: true }).distance(a, b)).toBe(4)
    expect(chess.distance(a, a)).toBe(0)
  })

  it("has a distance that is the same both ways and takes no shortcut", () => {
    const rng = createRng(11)
    for (const diagonals of [false, true]) {
      const board = squareBoard({ columns: 7, rows: 6, diagonals })
      for (let i = 0; i < 200; i++) {
        const [a, b, c] = [0, 1, 2].map(() => Math.floor(rng() * board.size))
        expect(board.distance(a!, b!)).toBe(board.distance(b!, a!))
        expect(board.distance(a!, c!)).toBeLessThanOrEqual(board.distance(a!, b!) + board.distance(b!, c!))
      }
    }
  })

  it("refuses a board with no cell, and a cell or a direction it does not have", () => {
    for (const [columns, rows] of [
      [0, 3],
      [3, 0],
      [2.5, 3],
      [3, Number.NaN],
    ] as const)
      expect(() => squareBoard({ columns, rows }), `${columns} by ${rows}`).toThrow(RangeError)
    for (const cell of [-1, 64, 1.5, Number.NaN]) {
      expect(() => chess.neighbours(cell), String(cell)).toThrow(RangeError)
      expect(() => chess.distance(cell, 0), String(cell)).toThrow(RangeError)
    }
    expect(() => chess.step(0, 4)).toThrow(RangeError)
    expect(() => chess.step(0, -1)).toThrow(RangeError)
    expect(() => chess.step(0, 0.5)).toThrow(RangeError)
  })
})

describe("hexBoard with a radius", () => {
  it("has the cells of a hexagon of hexagons", () => {
    expect([0, 1, 2, 3].map((radius) => hexBoard({ radius }).size)).toEqual([1, 7, 19, 37])
  })

  it("numbers them row by row from the top, the row being r", () => {
    const board = hexBoard({ radius: 2 })
    expect(board.coords.slice(0, 3)).toEqual([
      [0, -2],
      [1, -2],
      [2, -2],
    ])
    expect(board.coords[9]).toEqual([0, 0])
    expect(board.coords[18]).toEqual([0, 2])
    for (let cell = 0; cell < board.size; cell++) expect(board.at(...board.coords[cell]!)).toBe(cell)
  })

  it("has cells that are all within the radius of the middle one, and none further", () => {
    const board = hexBoard({ radius: 3 })
    const middle = at(board, 0, 0)
    for (let cell = 0; cell < board.size; cell++) expect(board.distance(middle, cell)).toBeLessThanOrEqual(3)
    expect(board.at(4, 0)).toBe(-1)
    expect(board.at(3, 1)).toBe(-1)
    expect(board.at(-2, -2)).toBe(-1)
  })

  it("steps along six directions, clockwise seen from above from the right", () => {
    const board = hexBoard({ radius: 2 })
    const middle = at(board, 0, 0)
    expect(board.directions).toBe(6)
    expect([0, 1, 2, 3, 4, 5].map((direction) => board.coords[board.step(middle, direction)])).toEqual([
      [1, 0],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [0, -1],
      [1, -1],
    ])
  })

  it("has six neighbours in the middle, four on an edge and three in a corner", () => {
    const board = hexBoard({ radius: 2 })
    expect(board.neighbours(at(board, 0, 0))).toHaveLength(6)
    expect(board.neighbours(at(board, 1, 0 - 2 + 2))).toHaveLength(6)
    expect(board.neighbours(at(board, 1, -2))).toHaveLength(4)
    expect(board.neighbours(at(board, 0, -2))).toHaveLength(3)
    expect(board.neighbours(at(board, 2, -2))).toHaveLength(3)
  })

  it("makes every neighbour mutual", () => {
    const board = hexBoard({ radius: 3 })
    for (let cell = 0; cell < board.size; cell++) for (const next of board.neighbours(cell)) expect(board.neighbours(next)).toContain(cell)
  })

  it("counts the distance in steps: the ring round the middle is at the radius", () => {
    const board = hexBoard({ radius: 3 })
    const middle = at(board, 0, 0)
    const counts = [0, 0, 0, 0]
    for (let cell = 0; cell < board.size; cell++) counts[board.distance(middle, cell)]!++
    expect(counts).toEqual([1, 6, 12, 18])
    expect(board.distance(at(board, -3, 0), at(board, 3, 0))).toBe(6)
    expect(board.distance(at(board, 0, -3), at(board, 0, 3))).toBe(6)
    expect(board.distance(at(board, 3, -3), at(board, -3, 3))).toBe(6)
  })

  it("has a distance that is the same both ways and takes no shortcut, and that is the number of steps of the shortest way", () => {
    const board = hexBoard({ radius: 3 })
    const rng = createRng(3)
    for (let i = 0; i < 200; i++) {
      const [a, b, c] = [0, 1, 2].map(() => Math.floor(rng() * board.size))
      expect(board.distance(a!, b!)).toBe(board.distance(b!, a!))
      expect(board.distance(a!, c!)).toBeLessThanOrEqual(board.distance(a!, b!) + board.distance(b!, c!))
      expect(shortestPath(board, a!, b!)!.length).toBe(board.distance(a!, b!))
    }
  })

  it("refuses a radius that is not a number of cells", () => {
    for (const radius of [-1, 1.5, Number.NaN]) expect(() => hexBoard({ radius }), String(radius)).toThrow(RangeError)
  })
})

describe("hexBoard with columns and rows", () => {
  const board = hexBoard({ columns: 5, rows: 4 })
  const cellOf = (col: number, row: number) => row * 5 + col

  it("is a rectangle numbered like a square board", () => {
    expect(board.size).toBe(20)
    expect(new Set(board.coords.map(([q, r]) => `${q},${r}`)).size).toBe(20)
    expect(board.coords[cellOf(0, 0)]).toEqual([0, 0])
    expect(board.coords[cellOf(4, 0)]).toEqual([4, 0])
    expect(board.coords[cellOf(0, 1)]).toEqual([0, 1])
    expect(board.coords[cellOf(0, 2)]).toEqual([-1, 2])
  })

  it("shifts the odd rows half a cell to the right: a cell has the two cells over it and the two under it on the same side", () => {
    // An odd row: its neighbours above and below are the cell of its own column and the one to the right
    expect(sorted(board.neighbours(cellOf(2, 1)))).toEqual(sorted([cellOf(1, 1), cellOf(3, 1), cellOf(2, 0), cellOf(3, 0), cellOf(2, 2), cellOf(3, 2)]))
    // An even row: its own column and the one to the left
    expect(sorted(board.neighbours(cellOf(2, 2)))).toEqual(sorted([cellOf(1, 2), cellOf(3, 2), cellOf(1, 1), cellOf(2, 1), cellOf(1, 3), cellOf(2, 3)]))
  })

  it("has fewer neighbours at its edges: an odd row sticks out to the right, so its left edge is better placed than its right one", () => {
    expect(board.neighbours(cellOf(0, 0))).toHaveLength(2)
    expect(board.neighbours(cellOf(4, 0))).toHaveLength(3)
    expect(board.neighbours(cellOf(0, 1))).toHaveLength(5)
    expect(board.neighbours(cellOf(4, 1))).toHaveLength(3)
    expect(board.neighbours(cellOf(2, 2))).toHaveLength(6)
  })

  it("counts the distance across the rectangle", () => {
    expect(board.distance(cellOf(0, 0), cellOf(4, 0))).toBe(4)
    expect(board.distance(cellOf(0, 0), cellOf(0, 3))).toBe(3)
    expect(board.distance(cellOf(0, 0), cellOf(4, 3))).toBe(6)
  })

  it("refuses a board with no cell", () => {
    expect(() => hexBoard({ columns: 0, rows: 3 })).toThrow(RangeError)
    expect(() => hexBoard({ columns: 3, rows: 1.5 })).toThrow(RangeError)
  })
})

describe("reachable", () => {
  it("is the cells within the range when nothing is in the way, each with its distance, nearest first", () => {
    for (const board of [squareBoard({ columns: 7, rows: 7 }), squareBoard({ columns: 7, rows: 7, diagonals: true }), hexBoard({ radius: 3 })]) {
      const from = Math.floor(board.size / 2)
      for (const range of [0, 1, 2, 3]) {
        const found = reachable(board, from, range)
        const expected = Array.from({ length: board.size }, (_, cell) => cell).filter((cell) => board.distance(from, cell) <= range)
        expect(sorted(found.map((reached) => reached.cell))).toEqual(expected)
        for (const { cell, distance } of found) expect(distance).toBe(board.distance(from, cell))
        const distances = found.map((reached) => reached.distance)
        expect(distances).toEqual([...distances].sort((a, b) => a - b))
      }
    }
  })

  it("starts with the cell it starts from, at distance 0, even when it is blocked", () => {
    const board = squareBoard({ columns: 3, rows: 3 })
    expect(reachable(board, 4, 0)).toEqual([{ cell: 4, distance: 0 }])
    expect(reachable(board, 4, 1, { blocked: () => true })).toEqual([{ cell: 4, distance: 0 }])
  })

  it("orders the cells of the same distance by their number", () => {
    const board = squareBoard({ columns: 3, rows: 3 })
    expect(reachable(board, 4, 1)).toEqual([
      { cell: 4, distance: 0 },
      { cell: 1, distance: 1 },
      { cell: 3, distance: 1 },
      { cell: 5, distance: 1 },
      { cell: 7, distance: 1 },
    ])
  })

  it("does not enter a blocked cell, nor go through it", () => {
    // A wall across the middle row of a 5 by 5 board, with a gap at the right
    const board = squareBoard({ columns: 5, rows: 5 })
    const wall = new Set([10, 11, 12, 13])
    const found = reachable(board, 2, 10, { blocked: (cell) => wall.has(cell) })
    for (const { cell } of found) expect(wall.has(cell)).toBe(false)
    // The far side is reached by the gap, so it is further than it looks
    expect(found.find((reached) => reached.cell === 20)?.distance).toBe(10)
    expect(reachable(board, 2, 4, { blocked: (cell) => wall.has(cell) }).some((reached) => reached.cell === 20)).toBe(false)
  })

  it("does not reach a cell that a wall closes in", () => {
    const board = squareBoard({ columns: 3, rows: 3 })
    const found = reachable(board, 0, 10, { blocked: (cell) => cell === 1 || cell === 3 })
    expect(found.map((reached) => reached.cell)).toEqual([0])
  })

  it("refuses a start that is not a cell and a range that is not a number of steps", () => {
    const board = squareBoard({ columns: 3, rows: 3 })
    expect(() => reachable(board, 9, 1)).toThrow(RangeError)
    for (const range of [-1, 1.5, Number.NaN]) expect(() => reachable(board, 0, range), String(range)).toThrow(RangeError)
  })
})

describe("shortestPath", () => {
  const board = squareBoard({ columns: 5, rows: 5 })

  it("goes from one cell to another by the fewest steps, ending on the goal", () => {
    const path = shortestPath(board, at(board, 0, 0), at(board, 3, 2))!
    expect(path).toHaveLength(5)
    expect(path[path.length - 1]).toBe(at(board, 3, 2))
    let before = at(board, 0, 0)
    for (const cell of path) {
      expect(board.neighbours(before)).toContain(cell)
      before = cell
    }
  })

  it("is as long as the distance when nothing is in the way, on every board", () => {
    const rng = createRng(21)
    for (const grid of [squareBoard({ columns: 6, rows: 5 }), squareBoard({ columns: 6, rows: 5, diagonals: true }), hexBoard({ radius: 3 }), hexBoard({ columns: 5, rows: 5 })]) {
      for (let i = 0; i < 60; i++) {
        const [a, b] = [0, 1].map(() => Math.floor(rng() * grid.size))
        expect(shortestPath(grid, a!, b!)!.length, `${grid.kind} ${a} to ${b}`).toBe(grid.distance(a!, b!))
      }
    }
  })

  it("goes nowhere to go to where it is", () => {
    expect(shortestPath(board, 7, 7)).toEqual([])
  })

  it("goes round what is in the way", () => {
    // The same wall as above: from the top to the bottom through the gap at the right
    const wall = new Set([10, 11, 12, 13])
    const path = shortestPath(board, 2, 22, { blocked: (cell) => wall.has(cell) })!
    expect(path).toHaveLength(8)
    for (const cell of path) expect(wall.has(cell)).toBe(false)
    expect(path[path.length - 1]).toBe(22)
  })

  it("finds no way into a closed place, nor to a blocked goal", () => {
    expect(shortestPath(board, 0, 24, { blocked: (cell) => cell === 1 || cell === 5 })).toBeNull()
    expect(shortestPath(board, 0, 24, { blocked: (cell) => cell === 24 })).toBeNull()
  })

  it("always takes the same way between two ways as long as one another: the first direction that works", () => {
    const first = shortestPath(board, 0, 12)!
    expect(first).toEqual(shortestPath(board, 0, 12))
    // East is tried before south, so the way goes along the top row first
    expect(first.slice(0, 2)).toEqual([1, 2])
  })

  it("refuses cells that are not on the board", () => {
    expect(() => shortestPath(board, 25, 0)).toThrow(RangeError)
    expect(() => shortestPath(board, 0, -1)).toThrow(RangeError)
  })
})

describe("regionOf", () => {
  const board = squareBoard({ columns: 5, rows: 5 })
  // Two groups of stones on a 5 by 5 board, X for black: the cells of the lines
  //   X X . . X
  //   . X . X X
  //   . . . . .
  const black = new Set([0, 1, 6, 4, 8, 9])
  const isBlack = (cell: number) => black.has(cell)

  it("is the group a cell belongs to, the start included, in the order of the numbers", () => {
    expect(regionOf(board, 0, isBlack)).toEqual([0, 1, 6])
    expect(regionOf(board, 9, isBlack)).toEqual([4, 8, 9])
  })

  it("is the same from any cell of the group", () => {
    expect(regionOf(board, 6, isBlack)).toEqual(regionOf(board, 0, isBlack))
    expect(regionOf(board, 4, isBlack)).toEqual(regionOf(board, 9, isBlack))
  })

  it("is empty when the start is not one of the cells that count", () => {
    expect(regionOf(board, 2, isBlack)).toEqual([])
  })

  it("links the cells that touch by a corner when the board does", () => {
    const king = squareBoard({ columns: 5, rows: 5, diagonals: true })
    expect(regionOf(king, 0, isBlack)).toEqual([0, 1, 6])
    // The cells 6 and 8 are two apart on a row: they stay apart, but 6 and 12 would touch
    expect(regionOf(king, 6, (cell) => cell === 6 || cell === 12 || cell === 18)).toEqual([6, 12, 18])
    expect(regionOf(board, 6, (cell) => cell === 6 || cell === 12 || cell === 18)).toEqual([6])
  })

  it("fills a whole board when every cell counts", () => {
    for (const grid of [board, hexBoard({ radius: 2 })]) expect(regionOf(grid, 0, () => true)).toHaveLength(grid.size)
  })
})

describe("lineBetween", () => {
  it("goes in a straight line on a square board, from the cell after the start to the goal", () => {
    const board = squareBoard({ columns: 8, rows: 8 })
    expect(lineBetween(board, at(board, 0, 0), at(board, 4, 0))).toEqual([1, 2, 3, 4])
    expect(lineBetween(board, at(board, 0, 0), at(board, 0, 3))).toEqual([8, 16, 24])
    expect(lineBetween(board, at(board, 0, 0), at(board, 3, 3))).toEqual([9, 18, 27])
    expect(lineBetween(board, at(board, 3, 3), at(board, 0, 0))).toEqual([18, 9, 0])
  })

  it("has as many cells as the longest of the two distances, and ends on the goal, whatever the angle", () => {
    const board = squareBoard({ columns: 9, rows: 9, diagonals: true })
    const rng = createRng(5)
    for (let i = 0; i < 100; i++) {
      const [a, b] = [0, 1].map(() => Math.floor(rng() * board.size))
      const line = lineBetween(board, a!, b!)
      expect(line).toHaveLength(board.distance(a!, b!))
      expect(line[line.length - 1] ?? a).toBe(b)
      let before = a!
      for (const cell of line) {
        expect(board.neighbours(before)).toContain(cell)
        before = cell
      }
    }
  })

  it("goes in a straight line on a hexagonal board, one cell at a time", () => {
    const board = hexBoard({ radius: 3 })
    const rng = createRng(8)
    for (let i = 0; i < 100; i++) {
      const [a, b] = [0, 1].map(() => Math.floor(rng() * board.size))
      const line = lineBetween(board, a!, b!)
      expect(line).toHaveLength(board.distance(a!, b!))
      expect(line[line.length - 1] ?? a).toBe(b)
      let before = a!
      for (const cell of line) {
        expect(board.neighbours(before)).toContain(cell)
        before = cell
      }
    }
  })

  it("goes along a row of hexagons when the two cells are on one", () => {
    const board = hexBoard({ radius: 3 })
    expect(lineBetween(board, at(board, -3, 0), at(board, 3, 0)).map((cell) => board.coords[cell]![0])).toEqual([-2, -1, 0, 1, 2, 3])
  })

  it("goes nowhere to go to where it is", () => {
    expect(lineBetween(squareBoard({ columns: 3, rows: 3 }), 4, 4)).toEqual([])
    expect(lineBetween(hexBoard({ radius: 1 }), 3, 3)).toEqual([])
  })

  it("refuses cells that are not on the board", () => {
    expect(() => lineBetween(squareBoard({ columns: 3, rows: 3 }), 9, 0)).toThrow(RangeError)
  })
})

describe("rayFrom", () => {
  const board = squareBoard({ columns: 5, rows: 5, diagonals: true })

  it("goes to the edge of the board when nothing is in the way", () => {
    expect(rayFrom(board, at(board, 1, 2), 0)).toEqual({ open: [at(board, 2, 2), at(board, 3, 2), at(board, 4, 2)], stoppedBy: null })
    expect(rayFrom(board, at(board, 1, 2), 4)).toEqual({ open: [at(board, 0, 2)], stoppedBy: null })
  })

  it("goes along a corner", () => {
    expect(rayFrom(board, 0, 1)).toEqual({ open: [6, 12, 18, 24], stoppedBy: null })
  })

  it("stops at the first blocked cell, which is not open but is what stopped it", () => {
    const stones = new Set([at(board, 3, 2)])
    expect(rayFrom(board, at(board, 1, 2), 0, { blocked: (cell) => stones.has(cell) })).toEqual({ open: [at(board, 2, 2)], stoppedBy: at(board, 3, 2) })
  })

  it("stops at once when the cell next to it is blocked", () => {
    expect(rayFrom(board, 0, 0, { blocked: () => true })).toEqual({ open: [], stoppedBy: 1 })
  })

  it("sees nothing from the edge it faces", () => {
    expect(rayFrom(board, 0, 4)).toEqual({ open: [], stoppedBy: null })
  })

  it("goes along the six directions of a hexagonal board", () => {
    const hex = hexBoard({ radius: 2 })
    const middle = at(hex, 0, 0)
    for (let direction = 0; direction < 6; direction++) expect(rayFrom(hex, middle, direction).open).toHaveLength(2)
  })

  it("refuses a direction the board does not have, and a cell it does not have", () => {
    expect(() => rayFrom(squareBoard({ columns: 3, rows: 3 }), 0, 4)).toThrow(RangeError)
    expect(() => rayFrom(board, 25, 0)).toThrow(RangeError)
  })
})
