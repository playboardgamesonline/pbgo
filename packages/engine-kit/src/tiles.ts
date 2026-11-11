/**
 * Tiles with edges. A tile is laid on a grid of squares or hexagons that has no end, turned one way or another, and what it shows on each of its sides decides what may lie against it: a road goes on with a road and a city with a city
 * (Carcassonne), a number with the same number (dominoes). The state keeps the tiles that are laid, each as the cell it lies on, which tile it is and how many turns it was given, and nothing else: the edges, the free places and what may go where
 * are worked out from it, so a `tiling` is made again at every move and never stored.
 *
 * A cell has two numbers like those of a board's, `[col, row]` on squares and `[q, r]` on hexagons, and the sides of a tile are numbered as the directions of a `Board` are: clockwise seen from above, from the right, so east, south, west, north
 * on squares and east, south-east, south-west, west, north-west, north-east on hexagons. A tile's `turns` are quarter turns, or sixth turns, clockwise: a tile turned once shows on its south what it had on its east. What a tile shows on a side is
 * an edge, any value the game likes (`"road"`, `"city"`, a number): two edges that touch must match, equal unless the game says otherwise. A part of a tile that goes from side to side, a road or a city, is a `Segment`, and `features` joins the
 * segments of neighbouring tiles into the roads and cities of the whole layout, with how many of their sides are still open.
 */

import type { Coord } from "./board"

/** The grid the tiles are laid on. Its cells are named like those of a board, and there is no end to it: a tiling is as big as the tiles laid on it */
export type Lattice = "square" | "hex"

/** The steps from a cell to the cell across each of its sides, in the order of the sides: the directions of a `Board`, east first and clockwise */
const STEPS: Record<Lattice, readonly Coord[]> = {
  square: [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ],
  hex: [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ],
}

/** The cells that touch a cell: the corners of a square count, so there are eight, east first and clockwise, as the diagonal directions of a square `Board` */
const SURROUND: Record<Lattice, readonly Coord[]> = {
  square: [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ],
  hex: STEPS.hex,
}

function assertLattice(lattice: Lattice): void {
  if (lattice !== "square" && lattice !== "hex") throw new RangeError(`A grid of tiles is square or hex, got ${String(lattice)}`)
}

function assertCoord(at: Coord): void {
  if (!Array.isArray(at) || at.length !== 2 || !Number.isInteger(at[0]) || !Number.isInteger(at[1])) throw new RangeError(`A cell is two whole numbers, got ${JSON.stringify(at)}`)
}

function assertSide(lattice: Lattice, side: number): void {
  const count = STEPS[lattice].length
  if (!Number.isInteger(side) || side < 0 || side >= count) throw new RangeError(`There is no side ${String(side)}: a ${lattice} tile has ${count}`)
}

const keyOf = ([a, b]: Coord) => `${a},${b}`
const mod = (value: number, size: number) => ((value % size) + size) % size

/** How many sides a tile has on this grid: 4 on squares, 6 on hexagons */
export function sidesOf(lattice: Lattice): number {
  assertLattice(lattice)
  return STEPS[lattice].length
}

/** The cell across a side of a cell. The cells have no end, so there is always one */
export function neighbourOf(lattice: Lattice, at: Coord, side: number): Coord {
  assertLattice(lattice)
  assertCoord(at)
  assertSide(lattice, side)
  const [da, db] = STEPS[lattice][side]!
  return [at[0] + da, at[1] + db]
}

/** The side that touches this one, on the tile across: the one at the other end of the line through the middle of the tile, half the sides further round */
export function oppositeSide(lattice: Lattice, side: number): number {
  assertLattice(lattice)
  assertSide(lattice, side)
  return (side + STEPS[lattice].length / 2) % STEPS[lattice].length
}

/** The cells that touch a cell, the ones that share a corner with it included on squares (so eight there, six on hexagons), in the order of the sides starting from the east: where a monastery of Carcassonne wants every cell laid */
export function around(lattice: Lattice, at: Coord): Coord[] {
  assertLattice(lattice)
  assertCoord(at)
  return SURROUND[lattice].map(([da, db]) => [at[0] + da, at[1] + db] as const)
}

/**
 * The edges of a tile once it has been turned `turns` times clockwise: the edge that was on side `s` is on side `s + turns` now, so `result[d]` is `edges[d - turns]`, the numbers going round. A number of turns of any size counts, a negative one turns
 * the other way, and zero gives the edges as they were.
 */
export function turnEdges<E>(edges: readonly E[], turns: number): E[] {
  if (edges.length === 0) throw new RangeError("A tile has sides, none given")
  if (!Number.isInteger(turns)) throw new RangeError(`A tile is turned a whole number of times, got ${String(turns)}`)
  return edges.map((_, side) => edges[mod(side - turns, edges.length)]!)
}

/**
 * The turns, from 0 and in order, that show a tile in a way it was not shown before: all of them for a tile whose sides all differ, just the first for a tile whose sides are all the same, two for a straight road. It is the turns to offer a player,
 * and the ones to try when looking for where a tile fits. Edges are the same when they are `===`.
 */
export function distinctTurns<E>(edges: readonly E[]): number[] {
  const kept: E[][] = []
  const turns: number[] = []
  for (let turn = 0; turn < edges.length; turn++) {
    const shown = turnEdges(edges, turn)
    if (kept.some((seen) => seen.every((edge, side) => edge === shown[side]))) continue
    kept.push(shown)
    turns.push(turn)
  }
  return turns
}

/** The edges of a tile of squares given by the side they are on, in the order of the sides: east, south, west, north. A tile drawn with its north up has its north on top, as the picture shows */
export function squareEdges<E>({ north, east, south, west }: { north: E; east: E; south: E; west: E }): [E, E, E, E] {
  return [east, south, west, north]
}

/** The edges of a tile of hexagons with a point up given by the side they are on, in the order of the sides: east, south-east, south-west, west, north-west, north-east */
export function hexEdges<E>({ east, southEast, southWest, west, northWest, northEast }: { east: E; southEast: E; southWest: E; west: E; northWest: E; northEast: E }): [E, E, E, E, E, E] {
  return [east, southEast, southWest, west, northWest, northEast]
}

/** A tile that has been laid: the cell it lies on, which tile it is (the game's own id for it) and how many times it was turned clockwise from the way it is drawn. It is what the state keeps */
export type LaidTile<T = number> = { at: Coord; tile: T; turns: number }

/** A place a tile may be laid: the cell, and how it is turned */
export type Placement = { at: Coord; turns: number }

export type TileRules<E = string> = {
  /** Whether two edges that touch go together (default: they are equal). It is given the edge of the tile that is laid first and the edge of the tile it lies against */
  matches?: (laid: E, against: E) => boolean
  /** The cells a tile may be laid on at all (default: any), for a table that has an end or a kingdom that may not grow past five across */
  allowed?: (at: Coord) => boolean
}

/** The tiles that are laid, seen as a whole: what lies where, which cells are free to lay on, and where a tile fits */
export type Tiling<T = number, E = string> = {
  readonly lattice: Lattice
  /** How many sides a tile has here */
  readonly sides: number
  /** The tiles, in the order they were laid: the same list that was given */
  readonly laid: readonly LaidTile<T>[]
  /** The place in `laid` of the tile at this cell, or -1 when none is laid there */
  at(at: Coord): number
  /** What the tile at this cell shows on this side, turned as it was laid, or `undefined` when no tile is there */
  edge(at: Coord, side: number): E | undefined
  /**
   * The free cells that touch a tile that is laid, one after the other in the order the tiles were laid and the sides went round: the places a tile can be laid next to what is there. A layout with no tile has one, the cell `[0, 0]`, where the first
   * tile goes
   */
  spots(): Coord[]
  /** Whether a tile that shows these `edges` (as it lies, already turned) may be laid at this cell: the cell is free and allowed, it lies against a tile, or is the first, and each side that touches a tile matches it */
  fits(at: Coord, edges: readonly E[], rules?: TileRules<E>): boolean
  /** Every way a tile with these `edges` (as it is drawn) may be laid: each of the `spots` where it fits, with each of the turns that show it differently, the spots in their order and the turns from 0 */
  placements(edges: readonly E[], rules?: TileRules<E>): Placement[]
  /** The least and the greatest column and row of the tiles that are laid, or `null` when none is */
  bounds(): { min: Coord; max: Coord } | null
}

/**
 * The tiles that are `laid` on a `lattice`, with `edgesOf` giving the edges of each tile as it is drawn (the game's table of tiles). Two tiles on one cell, or edges that are not as many as the sides of the grid, are bugs of the game. Made from the state
 * at every move: it keeps no more than it is given.
 */
export function tiling<T = number, E = string>(lattice: Lattice, laid: readonly LaidTile<T>[], edgesOf: (tile: T) => readonly E[]): Tiling<T, E> {
  const sides = sidesOf(lattice)
  const index = new Map<string, number>()
  const turned: E[][] = laid.map((one, place) => {
    assertCoord(one.at)
    const edges = edgesOf(one.tile)
    if (edges.length !== sides) throw new RangeError(`A ${lattice} tile has ${sides} edges, the tile at ${keyOf(one.at)} has ${edges.length}`)
    if (index.has(keyOf(one.at))) throw new RangeError(`Two tiles are laid at ${keyOf(one.at)}`)
    index.set(keyOf(one.at), place)
    return turnEdges(edges, one.turns)
  })

  const at = (cell: Coord): number => {
    assertCoord(cell)
    return index.get(keyOf(cell)) ?? -1
  }
  const edge = (cell: Coord, side: number): E | undefined => {
    assertSide(lattice, side)
    const place = at(cell)
    return place < 0 ? undefined : turned[place]![side]
  }
  const spots = (): Coord[] => {
    if (laid.length === 0) return [[0, 0]]
    const found = new Map<string, Coord>()
    for (const one of laid) {
      for (let side = 0; side < sides; side++) {
        const next = neighbourOf(lattice, one.at, side)
        if (!index.has(keyOf(next)) && !found.has(keyOf(next))) found.set(keyOf(next), next)
      }
    }
    return [...found.values()]
  }
  const fits = (cell: Coord, edges: readonly E[], { matches = (a, b) => a === b, allowed = () => true }: TileRules<E> = {}): boolean => {
    assertCoord(cell)
    if (edges.length !== sides) throw new RangeError(`A ${lattice} tile has ${sides} edges, got ${edges.length}`)
    if (index.has(keyOf(cell)) || !allowed(cell)) return false
    // The first tile goes on the first spot, wherever the game starts its table from
    if (laid.length === 0) return keyOf(cell) === "0,0"
    let touching = 0
    for (let side = 0; side < sides; side++) {
      const place = index.get(keyOf(neighbourOf(lattice, cell, side)))
      if (place === undefined) continue
      touching++
      if (!matches(edges[side]!, turned[place]![oppositeSide(lattice, side)]!)) return false
    }
    return touching > 0
  }
  const placements = (edges: readonly E[], rules?: TileRules<E>): Placement[] => {
    const shown = distinctTurns(edges).map((turn) => [turn, turnEdges(edges, turn)] as const)
    return spots().flatMap((cell) => shown.filter(([, turnedEdges]) => fits(cell, turnedEdges, rules)).map(([turns]) => ({ at: cell, turns })))
  }
  const bounds = () => {
    if (laid.length === 0) return null
    const cols = laid.map((one) => one.at[0])
    const rows = laid.map((one) => one.at[1])
    return { min: [Math.min(...cols), Math.min(...rows)] as const, max: [Math.max(...cols), Math.max(...rows)] as const }
  }
  return { lattice, sides, laid, at, edge, spots, fits, placements, bounds }
}

/** A part of a tile that goes from side to side: a road, a city, a field. Where it touches the sides of its tile decides what it is joined to */
export type Segment<K = string> = {
  /** What it is: the game's own word for a road, a city, a field. Only segments of one kind are joined */
  kind: K
  /** Where it touches the sides of its tile: the side, numbered as the edges are before the tile is turned, and the `slot` along that side, from 0 and clockwise round the tile. A segment with no port is alone: a monastery */
  ports: readonly (readonly [side: number, slot: number])[]
}

/**
 * The mistakes in the segments of one tile, as sentences, or none: a port that is not on the tile, a port that two segments hold, and, unless `complete` is false, a port that no segment holds. A game writes its table of tiles by hand, and a port
 * left out or counted twice joins a road to a field without a word, so the table is the one thing to test: `expect(segmentProblems("square", segments, { slots: 3 })).toEqual([])` for every tile.
 */
export function segmentProblems<K>(lattice: Lattice, segments: readonly Segment<K>[], { slots = 1, complete = true }: { slots?: number; complete?: boolean } = {}): string[] {
  const sides = sidesOf(lattice)
  const problems: string[] = []
  const held = new Map<string, number>()
  segments.forEach((segment, which) => {
    for (const [side, slot] of segment.ports) {
      const where = `port ${slot} of side ${side}`
      if (!Number.isInteger(side) || side < 0 || side >= sides || !Number.isInteger(slot) || slot < 0 || slot >= slots) problems.push(`Segment ${which} has ${where}, which is not on the tile`)
      else if (held.has(`${side}:${slot}`)) problems.push(`Segments ${held.get(`${side}:${slot}`)} and ${which} both hold ${where}`)
      else held.set(`${side}:${slot}`, which)
    }
  })
  if (complete) {
    for (let side = 0; side < sides; side++) for (let slot = 0; slot < slots; slot++) if (!held.has(`${side}:${slot}`)) problems.push(`No segment holds port ${slot} of side ${side}`)
  }
  return problems
}

/** The roads, the cities, the fields of a whole layout: segments that are joined from tile to tile */
export type Feature<K = string> = {
  kind: K
  /** What it is made of: the tile, as its place in the layout's `laid`, and the segment, as its place in that tile's list. In the order of the layout */
  parts: { tile: number; segment: number }[]
  /** How many of its sides face a cell with no tile, a side with several ports counting once: what is still to be laid for it to be complete. 0 when nothing more can be added: a city that is closed, a road that ends at both ends */
  open: number
}

/**
 * The features of a layout: each segment of each tile, joined to the segments of the same kind that it touches across a side, and the segments joined in turn. `segmentsOf` gives the segments of each tile as it is drawn, and `slots` says how many ports a
 * side has (1 by default; Carcassonne has three, so that a field is not joined across a road). The slot `k` of a side meets the slot `slots - 1 - k` of the side it touches, since both are counted clockwise round their own tile. A side that touches a
 * tile where nothing is on the matching port does not join and is not open. The features come in the order of their first part.
 */
export function features<T, E, K = string>(grid: Tiling<T, E>, segmentsOf: (tile: T) => readonly Segment<K>[], { slots = 1 }: { slots?: number } = {}): Feature<K>[] {
  if (!Number.isInteger(slots) || slots < 1) throw new RangeError(`A side has a whole number of ports, one at the least, got ${String(slots)}`)
  const { lattice, laid, sides } = grid
  // Every segment of every tile is a node, numbered in the order of the tiles and of their lists
  const lists = laid.map((one) => segmentsOf(one.tile))
  const first: number[] = []
  const nodes: { tile: number; segment: number; kind: K }[] = []
  lists.forEach((list, tile) => {
    first.push(nodes.length)
    list.forEach((segment, which) => nodes.push({ tile, segment: which, kind: segment.kind }))
  })
  // The nodes that are joined share a root, which is the least of them
  const parent = nodes.map((_, node) => node)
  const find = (node: number): number => {
    let root = node
    while (parent[root] !== root) root = parent[root]!
    let step = node
    while (parent[step] !== root) {
      const next = parent[step]!
      parent[step] = root
      step = next
    }
    return root
  }
  const join = (a: number, b: number) => {
    const [ra, rb] = [find(a), find(b)]
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
  }

  // The segment that holds each port of each tile, as the tile lies: its place in the layout, the side the port is on now, and its slot
  const holder = new Map<string, number>()
  const ports: { tile: number; node: number; side: number; slot: number }[] = []
  lists.forEach((list, tile) => {
    list.forEach((segment, which) => {
      for (const [side, slot] of segment.ports) {
        if (!Number.isInteger(side) || side < 0 || side >= sides) throw new RangeError(`There is no side ${String(side)}: a ${lattice} tile has ${sides}`)
        if (!Number.isInteger(slot) || slot < 0 || slot >= slots) throw new RangeError(`There is no port ${String(slot)} on a side: it has ${slots}`)
        const lies = mod(side + laid[tile]!.turns, sides)
        if (holder.has(`${tile}:${lies}:${slot}`)) throw new RangeError(`Two segments of the tile at ${keyOf(laid[tile]!.at)} hold the port ${slot} of side ${side}`)
        holder.set(`${tile}:${lies}:${slot}`, first[tile]! + which)
        ports.push({ tile, node: first[tile]! + which, side: lies, slot })
      }
    })
  })

  // Across each side the ports meet two by two, and the ones of one kind are joined. A side that touches no tile is open
  const openSides = new Map<number, Set<string>>()
  for (const { tile, node, side, slot } of ports) {
    const across = grid.at(neighbourOf(lattice, laid[tile]!.at, side))
    if (across < 0) {
      const open = openSides.get(node) ?? new Set<string>()
      open.add(`${tile}:${side}`)
      openSides.set(node, open)
      continue
    }
    const other = holder.get(`${across}:${oppositeSide(lattice, side)}:${slots - 1 - slot}`)
    if (other !== undefined && nodes[other]!.kind === nodes[node]!.kind) join(node, other)
  }

  // The features, in the order of their first node, which is their root: the first time a root is met is its least node
  const found = new Map<number, Feature<K>>()
  const openAt = new Map<number, Set<string>>()
  nodes.forEach(({ tile, segment, kind }, node) => {
    const root = find(node)
    let feature = found.get(root)
    if (!feature) {
      feature = { kind, parts: [], open: 0 }
      found.set(root, feature)
      openAt.set(root, new Set())
    }
    feature.parts.push({ tile, segment })
    for (const side of openSides.get(node) ?? []) openAt.get(root)!.add(side)
  })
  return [...found].map(([root, feature]) => ({ ...feature, open: openAt.get(root)!.size }))
}
