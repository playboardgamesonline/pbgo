/**
 * Boards. A board is a set of cells that touch one another, laid out in a regular grid: the squares of a chessboard, the hexagons of a map. The state keeps where things are as the number of a cell, a whole number from 0, and nothing else: no
 * coordinates, no names (the board knows the cells by their number, and the table draws them with a `Board`). The engine asks the board who is next to a cell, how far two cells are, which cells a piece can reach, the way from one to another, and
 * which cells are linked together; it works the rest out from its own state.
 *
 * Two grids are built: `squareBoard`, with the squares next to a cell by their sides and, when the game says so, by their corners, and `hexBoard`, whose hexagons are six to a cell. A board that is not a grid (the map of Ticket to Ride, the
 * territories of Risk) is a `graph` of places and roads, and the corners of a board's cells, where Catan builds, are a `cornerGraph` (`graph.ts`): the searches below work on them too.
 */

/** A cell has two numbers: its column and its row on a square board, its `q` and its `r` (axial coordinates) on a hexagonal one */
export type Coord = readonly [number, number]

/** What a search needs of a board: how many cells it has, and which are next to which. A `Board` is one; so is a `Graph` of places and roads, and so are the corners of a board (`graph.ts`) */
export type Network = Pick<Board, "size" | "neighbours">

export type Board = {
  /** The kind of grid */
  readonly kind: "square" | "hex"
  /** How many cells the board has: their numbers go from 0 to `size - 1` */
  readonly size: number
  /** The two numbers that place each cell, in the order of the cells: `[col, row]` on a square board, `[q, r]` on a hexagonal one. A row grows toward the viewer, and a column toward their right */
  readonly coords: readonly Coord[]
  /** How many directions a step can go: 4 or 8 on a square board, 6 on a hexagonal one. They go clockwise seen from above, from the right */
  readonly directions: number
  /** The cell at these two numbers, or -1 when the board has none there */
  at(a: number, b: number): number
  /** The cell one step from `cell` in `direction`, or -1 when that step leaves the board */
  step(cell: number, direction: number): number
  /** The cells next to `cell`, in the order of the directions */
  neighbours(cell: number): number[]
  /** How many steps it takes to go from one cell to another when nothing is in the way */
  distance(from: number, to: number): number
}

/** The number of the cell must be a cell of the board: anything else is a bug of the game */
function assertCell(board: Pick<Board, "size">, cell: number, name = "cell"): void {
  if (!Number.isInteger(cell) || cell < 0 || cell >= board.size) throw new RangeError(`There is no ${name} ${String(cell)} on a board of ${board.size} cells`)
}

function makeBoard(kind: Board["kind"], coords: Coord[], steps: readonly Coord[], distance: (from: Coord, to: Coord) => number): Board {
  const index = new Map(coords.map(([a, b], cell) => [`${a},${b}`, cell] as const))
  const at = (a: number, b: number) => index.get(`${a},${b}`) ?? -1
  const board: Board = {
    kind,
    size: coords.length,
    coords,
    directions: steps.length,
    at,
    step(cell, direction) {
      assertCell(board, cell)
      if (!Number.isInteger(direction) || direction < 0 || direction >= steps.length) throw new RangeError(`There is no direction ${String(direction)}: this board has ${steps.length}`)
      const [a, b] = coords[cell]!
      const [da, db] = steps[direction]!
      return at(a + da, b + db)
    },
    neighbours: (cell) => steps.map((_, direction) => board.step(cell, direction)).filter((next) => next >= 0),
    distance(from, to) {
      assertCell(board, from)
      assertCell(board, to)
      return distance(coords[from]!, coords[to]!)
    },
  }
  return board
}

export type SquareBoardOptions = {
  columns: number
  rows: number
  /** The squares that touch by a corner are next to one another too, and a step can go on a diagonal: the king of chess, the eight squares round a mine (default false: only the sides) */
  diagonals?: boolean
}

/**
 * A board of squares, `columns` across and `rows` down, numbered row by row from the top left: the cell at column `col` and row `row` is `row * columns + col`. The first row is the farthest from the viewer. The steps go clockwise seen from above from
 * the right: east, south, west, north, and with `diagonals` east, south-east, south and so on, so that an even direction is a side and an odd one is a corner. `distance` counts the steps of the board: the sides only, or the king's moves.
 */
export function squareBoard({ columns, rows, diagonals = false }: SquareBoardOptions): Board {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) throw new RangeError(`A board has a whole number of columns and of rows, one at the least, got ${String(columns)} by ${String(rows)}`)
  const coords: Coord[] = Array.from({ length: columns * rows }, (_, cell) => [cell % columns, Math.floor(cell / columns)])
  const sides: Coord[] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ]
  const all: Coord[] = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ]
  return makeBoard("square", coords, diagonals ? all : sides, ([c0, r0], [c1, r1]) => (diagonals ? Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) : Math.abs(c1 - c0) + Math.abs(r1 - r0)))
}

export type HexBoardOptions = { radius: number } | { columns: number; rows: number }

/**
 * A board of hexagons with a point up, six to a cell. With a `radius` it is a hexagon of hexagons, round a middle cell (the radius 2 has 19 cells, the island of Catan's 19 land tiles); with `columns` and `rows` it is a rectangle, whose odd rows are
 * shifted half a cell to the right. The cells are numbered row by row from the top: a rectangle is numbered like a square board, `row * columns + col`. They have axial coordinates, `[q, r]`: `r` is the row and `q` goes to the right along it. The steps
 * go clockwise seen from above from the right: east, south-east, south-west, west, north-west, north-east.
 */
export function hexBoard(options: HexBoardOptions): Board {
  const coords: Coord[] = []
  if ("radius" in options) {
    const { radius } = options
    if (!Number.isInteger(radius) || radius < 0) throw new RangeError(`A board has a radius of a whole number of cells, got ${String(radius)}`)
    for (let r = -radius; r <= radius; r++) for (let q = Math.max(-radius, -radius - r); q <= Math.min(radius, radius - r); q++) coords.push([q, r])
  } else {
    const { columns, rows } = options
    if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) throw new RangeError(`A board has a whole number of columns and of rows, one at the least, got ${String(columns)} by ${String(rows)}`)
    for (let r = 0; r < rows; r++) for (let col = 0; col < columns; col++) coords.push([col - Math.floor(r / 2), r])
  }
  const steps: Coord[] = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ]
  return makeBoard("hex", coords, steps, ([q0, r0], [q1, r1]) => (Math.abs(q1 - q0) + Math.abs(r1 - r0) + Math.abs(q1 - q0 + (r1 - r0))) / 2)
}

/** What a search may not do */
export type BoardRules = {
  /** The cells that cannot be entered: a piece in the way, a wall. The cell a search starts from is never refused */
  blocked?: (cell: number) => boolean
}

/** A cell and how many steps it is from where the search began */
export type Reached = { cell: number; distance: number }

/**
 * The cells that can be reached from `from` in `range` steps at the most, going from one cell to the next and never into a blocked one, the start included at distance 0. The cells come nearest first, and in the order of their number for the same
 * distance. A piece that moves up to three cells, an area of effect that does not go through walls.
 */
export function reachable(board: Network, from: number, range: number, { blocked = () => false }: BoardRules = {}): Reached[] {
  assertCell(board, from, "start")
  if (!Number.isInteger(range) || range < 0) throw new RangeError(`A range is a whole number of steps, none at the least, got ${String(range)}`)
  const distances = new Map<number, number>([[from, 0]])
  const queue = [from]
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!
    const steps = distances.get(cell)!
    if (steps === range) continue
    for (const next of board.neighbours(cell)) {
      if (distances.has(next) || blocked(next)) continue
      distances.set(next, steps + 1)
      queue.push(next)
    }
  }
  return [...distances].map(([cell, distance]) => ({ cell, distance })).sort((a, b) => a.distance - b.distance || a.cell - b.cell)
}

/**
 * The way from `from` to `to`, the fewest steps, never into a blocked cell (`to` included): the cells to go through, one after the other, the last being `to`. Empty when the two are the same cell, `null` when there is no way. Between two ways of
 * the same length it takes the one that tries the directions in their order, so the same board gives the same way. It is what a piece walks along: give it to the board as the route of the piece.
 */
export function shortestPath(board: Network, from: number, to: number, { blocked = () => false }: BoardRules = {}): number[] | null {
  assertCell(board, from, "start")
  assertCell(board, to, "goal")
  if (from === to) return []
  const before = new Map<number, number>([[from, from]])
  const queue = [from]
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!
    for (const next of board.neighbours(cell)) {
      if (before.has(next) || blocked(next)) continue
      before.set(next, cell)
      if (next === to) {
        const path = [to]
        for (let back = cell; back !== from; back = before.get(back)!) path.unshift(back)
        return path
      }
      queue.push(next)
    }
  }
  return null
}

/**
 * The cells linked to `start` by cells that are `same` as it, the start included, in the order of their number: the group of stones of Go, the lake, the region a flood fills. `same` says whether a cell belongs. Empty when the start does not.
 */
export function regionOf(board: Network, start: number, same: (cell: number) => boolean): number[] {
  assertCell(board, start, "start")
  if (!same(start)) return []
  const seen = new Set([start])
  const queue = [start]
  for (let head = 0; head < queue.length; head++) {
    for (const next of board.neighbours(queue[head]!)) {
      if (seen.has(next) || !same(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return [...seen].sort((a, b) => a - b)
}

/** What a cell is in cube coordinates, which a straight line on hexagons is worked out in */
const cube = ([q, r]: Coord) => [q, -q - r, r] as const

/**
 * The cells a straight line goes through from `from` to `to`: the cells after `from`, the last being `to`, and none when they are the same cell. On a square board it is the line of Bresenham, on a hexagonal one the line of the
 * cells whose middle is the nearest to it. A line of sight, the cells a thrown piece crosses; it does not know of walls, so go along it and stop at the first one. It stops short where it leaves a board that has a hole.
 */
export function lineBetween(board: Board, from: number, to: number): number[] {
  assertCell(board, from, "start")
  assertCell(board, to, "goal")
  const cells: number[] = []
  if (board.kind === "square") {
    let [col, row] = board.coords[from]!
    const [col1, row1] = board.coords[to]!
    const [across, down] = [Math.abs(col1 - col), Math.abs(row1 - row)]
    const [toward, away] = [col < col1 ? 1 : -1, row < row1 ? 1 : -1]
    let error = across - down
    while (col !== col1 || row !== row1) {
      const twice = 2 * error
      if (twice > -down) {
        error -= down
        col += toward
      }
      if (twice < across) {
        error += across
        row += away
      }
      const cell = board.at(col, row)
      if (cell < 0) break
      cells.push(cell)
    }
    return cells
  }
  const length = board.distance(from, to)
  const [x0, y0, z0] = cube(board.coords[from]!)
  const [x1, y1, z1] = cube(board.coords[to]!)
  for (let i = 1; i <= length; i++) {
    const t = i / length
    // The start is nudged a hair so that a line that runs along the edge between two cells always goes the same side of it
    const [x, y, z] = [x0 + 1e-6 + (x1 - x0) * t, y0 + 2e-6 + (y1 - y0) * t, z0 - 3e-6 + (z1 - z0) * t]
    let [rx, ry, rz] = [Math.round(x), Math.round(y), Math.round(z)]
    const [dx, dy, dz] = [Math.abs(rx - x), Math.abs(ry - y), Math.abs(rz - z)]
    if (dx > dy && dx > dz) rx = -ry - rz
    else if (dy > dz) ry = -rx - rz
    else rz = -rx - ry
    const cell = board.at(rx, rz)
    if (cell < 0) break
    cells.push(cell)
  }
  return cells
}

/** What a ray found */
export type Ray = {
  /** The cells it went through, nearest first, that were not blocked */
  open: number[]
  /** The blocked cell it stopped at, or `null` when it went on to the edge of the board */
  stoppedBy: number | null
}

/**
 * The cells a piece that slides sees from `from` in `direction`, one after the other up to the edge of the board or the first blocked cell: the rook of chess, a beam. The blocked cell is not in `open`, it is `stoppedBy`, so that a game that lets a
 * piece take what it meets can add it. The directions are numbered as in `Board.directions`.
 */
export function rayFrom(board: Board, from: number, direction: number, { blocked = () => false }: BoardRules = {}): Ray {
  assertCell(board, from, "start")
  const open: number[] = []
  for (let cell = board.step(from, direction); cell >= 0; cell = board.step(cell, direction)) {
    if (blocked(cell)) return { open, stoppedBy: cell }
    open.push(cell)
  }
  return { open, stoppedBy: null }
}
