import type { Board, Network } from "./board"

/**
 * Maps and the corners of a board. A map is places joined by roads: the cities and the routes of Ticket to Ride, the territories of Risk and the borders between them, the cities of Pandemic and its links. The corners of a board are
 * a map too: on the island of Catan a settlement stands on a corner of the hexagons and a road on a side, and on a board of Go a stone stands on a corner of the squares. A graph is places numbered from 0 and roads numbered from 0, each the two
 * places it joins. The state keeps the numbers (a place that is taken, a road that belongs to a player) and the table draws the graph with a `Graph`. The searches of `board.ts` (`reachable`, `shortestPath`, `regionOf`) go along its roads
 * like they go from cell to cell on a board.
 */

/** A road: the two places it joins */
export type Edge = readonly [number, number]

export type Graph = Network & {
  /** The roads, each the two places it joins, in the order of their number */
  readonly edges: readonly Edge[]
  /** The roads that leave a place, in the order of their number */
  edgesAt(node: number): number[]
  /** The road between two places, or -1 when there is none: the first of them when there are several */
  edgeBetween(a: number, b: number): number
  /** All the roads between two places, in the order of their number: two for a double route, none when the places are not joined */
  edgesBetween(a: number, b: number): number[]
}

const keyOf = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)

/**
 * A graph of `size` places joined by `edges`. Two places may have several roads between them (the double routes of Ticket to Ride), each with a number of its own; no road leaves and comes back to the same place. Throws a `RangeError` for a size
 * that is not a whole number and for a road that joins a place the graph does not have, or a place to itself.
 */
export function graph(size: number, edges: readonly Edge[]): Graph {
  if (!Number.isInteger(size) || size < 0) throw new RangeError(`A graph has a whole number of places, none at the least, got ${String(size)}`)
  const at: number[][] = Array.from({ length: size }, () => [])
  const between = new Map<string, number[]>()
  edges.forEach(([a, b], edge) => {
    for (const node of [a, b]) {
      if (!Number.isInteger(node) || node < 0 || node >= size) throw new RangeError(`A road joins two places of the graph, 0 to ${size - 1}, got ${String(node)}`)
    }
    if (a === b) throw new RangeError(`A road joins two places, not one place to itself: ${a}`)
    between.set(keyOf(a, b), [...(between.get(keyOf(a, b)) ?? []), edge])
    at[a]!.push(edge)
    at[b]!.push(edge)
  })
  const assertNode = (node: number) => {
    if (!Number.isInteger(node) || node < 0 || node >= size) throw new RangeError(`There is no place ${String(node)} on a graph of ${size} places`)
  }
  const other = (edge: number, node: number) => (edges[edge]![0] === node ? edges[edge]![1] : edges[edge]![0])
  return {
    size,
    edges,
    neighbours(node) {
      assertNode(node)
      return [...new Set(at[node]!.map((edge) => other(edge, node)))].sort((a, b) => a - b)
    },
    edgesAt(node) {
      assertNode(node)
      return [...at[node]!]
    },
    edgeBetween: (a, b) => between.get(keyOf(a, b))?.[0] ?? -1,
    edgesBetween: (a, b) => [...(between.get(keyOf(a, b)) ?? [])],
  }
}

/** What a trail is held to */
export type TrailRules = {
  /** The places a trail may not go through, though it may start or end at one: an opponent's settlement on a road, a city that is closed */
  blocked?: (node: number) => boolean
  /** What a road is worth, a number of zero or more (default 1 for each road): the longest road of Catan counts the roads, the longest route of Ticket to Ride counts the trains of each */
  weight?: (edge: number) => number
}

/**
 * The most that a trail along `edges` is worth: a trail goes from place to place along roads and uses a road once, but may come back to a place. The longest road of Catan, the longest continuous route of Ticket to Ride. `edges` are the
 * numbers of the roads that count (those a player has built); the others are left out. It is 0 for no road. The search tries every trail, which is no trouble for the roads of one player in a game, some dozens, and a long time for a hundred
 * that cross one another. Throws a `RangeError` for a road the graph does not have, or a weight that is not a number of zero or more.
 */
export function longestTrail(map: Graph, edges: readonly number[], { blocked = () => false, weight = () => 1 }: TrailRules = {}): number {
  const weights = new Map<number, number>()
  const roads = new Map<number, { edge: number; to: number }[]>()
  for (const edge of new Set(edges)) {
    const road = map.edges[edge]
    if (!Number.isInteger(edge) || !road) throw new RangeError(`There is no road ${String(edge)} on this graph`)
    const worth = weight(edge)
    if (!Number.isFinite(worth) || worth < 0) throw new RangeError(`A road is worth a number of zero or more, got ${String(worth)} for road ${edge}`)
    weights.set(edge, worth)
    const [a, b] = road
    roads.set(a, [...(roads.get(a) ?? []), { edge, to: b }])
    roads.set(b, [...(roads.get(b) ?? []), { edge, to: a }])
  }
  const used = new Set<number>()
  let best = 0
  const walk = (node: number, total: number, moved: boolean) => {
    best = Math.max(best, total)
    // A trail that arrives at a place it may not go through ends there
    if (moved && blocked(node)) return
    for (const { edge, to } of roads.get(node) ?? []) {
      if (used.has(edge)) continue
      used.add(edge)
      walk(to, total + weights.get(edge)!, true)
      used.delete(edge)
    }
  }
  for (const node of roads.keys()) walk(node, 0, false)
  return best
}

/** Where a corner is from the middle of its cell, in units of the distance between the middles of two cells that are next to one another: the corners go clockwise seen from above, from the far point of a hexagon and from the top left of a square, the order of the corners of the cells of the table */
const HEX_CORNERS = Array.from({ length: 6 }, (_, k) => [Math.cos(-Math.PI / 2 + (k * Math.PI) / 3) / Math.sqrt(3), Math.sin(-Math.PI / 2 + (k * Math.PI) / 3) / Math.sqrt(3)] as const)
const SQUARE_CORNERS = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
] as const

/** The corners of a board: a graph whose places are the points where its cells meet and whose roads are the sides between them */
export type Corners = Graph & {
  /** The cells that meet at a point, in the order of their number: one to three on a hexagonal board, one to four on a square one */
  cellsAt(point: number): number[]
  /** The points of a cell, in the order of its corners: clockwise seen from above, the first being the far point of a hexagon and the top left of a square, as for the cells of the table */
  pointsOf(cell: number): number[]
  /** The sides of a cell: side `k` runs from corner `k` to corner `k + 1` of the cell */
  sidesOf(cell: number): number[]
  /** The cells on the two sides of a side: one on the edge of the board, two inside it */
  cellsOfSide(side: number): number[]
  /** Where a point is on the plane of the table, in units of the distance between the middles of two cells that are next to one another, x to the right and z toward the viewer, the middle of the cell at the coords 0, 0 being the origin */
  place(point: number): readonly [x: number, z: number]
}

/**
 * The corners of a board as a graph: its points are numbered in the order they are met going over the cells in their order and the corners of each in theirs, and its sides in the order they are met too. The settlements of Catan stand on points
 * and its roads on sides, the stones of Go on the points of a board of squares; a point is next to the points at the ends of its sides (`neighbours`), so the rule that two settlements are never next to one another is a look at them.
 */
export function cornerGraph(board: Board): Corners {
  const offsets = board.kind === "hex" ? HEX_CORNERS : SQUARE_CORNERS
  const middle = (cell: number): readonly [number, number] => {
    const [a, b] = board.coords[cell]!
    return board.kind === "hex" ? [a + b / 2, (Math.sqrt(3) / 2) * b] : [a, b]
  }
  const ids = new Map<string, number>()
  const places: (readonly [number, number])[] = []
  const meeting: number[][] = []
  const pointsOfCell: number[][] = []
  for (let cell = 0; cell < board.size; cell++) {
    const [mx, mz] = middle(cell)
    pointsOfCell[cell] = offsets.map(([dx, dz]) => {
      const [x, z] = [mx + dx, mz + dz]
      // The same corner reached from two cells differs by a rounding error at the most
      const key = `${Math.round(x * 1e6)},${Math.round(z * 1e6)}`
      let point = ids.get(key)
      if (point === undefined) {
        point = places.length
        ids.set(key, point)
        places.push([x, z])
        meeting.push([])
      }
      meeting[point]!.push(cell)
      return point
    })
  }
  const sideIds = new Map<string, number>()
  const sides: Edge[] = []
  const beside: number[][] = []
  const sidesOfCell: number[][] = []
  for (let cell = 0; cell < board.size; cell++) {
    const points = pointsOfCell[cell]!
    sidesOfCell[cell] = points.map((from, k) => {
      const to = points[(k + 1) % points.length]!
      const key = keyOf(from, to)
      let side = sideIds.get(key)
      if (side === undefined) {
        side = sides.length
        sideIds.set(key, side)
        sides.push(from < to ? [from, to] : [to, from])
        beside.push([])
      }
      beside[side]!.push(cell)
      return side
    })
  }
  const assertCell = (cell: number) => {
    if (!Number.isInteger(cell) || cell < 0 || cell >= board.size) throw new RangeError(`There is no cell ${String(cell)} on a board of ${board.size} cells`)
  }
  const corners = graph(places.length, sides)
  const assertPoint = (point: number) => {
    if (!Number.isInteger(point) || point < 0 || point >= places.length) throw new RangeError(`There is no point ${String(point)} on a board whose corners are ${places.length}`)
  }
  return {
    ...corners,
    cellsAt(point) {
      assertPoint(point)
      return [...meeting[point]!]
    },
    pointsOf(cell) {
      assertCell(cell)
      return [...pointsOfCell[cell]!]
    },
    sidesOf(cell) {
      assertCell(cell)
      return [...sidesOfCell[cell]!]
    },
    cellsOfSide(side) {
      if (!Number.isInteger(side) || side < 0 || side >= sides.length) throw new RangeError(`There is no side ${String(side)} on a board with ${sides.length} sides`)
      return [...beside[side]!]
    },
    place(point) {
      assertPoint(point)
      return places[point]!
    },
  }
}
