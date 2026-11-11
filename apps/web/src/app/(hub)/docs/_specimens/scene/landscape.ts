// The tiles of the landscape specimen, as the engine knows them: a handful of tiles with a road, a city or fields on each side, the table they are laid on, and the roads and the cities that are closed. The scene draws what this says and the controls
// read it, so it imports the kit and nothing else, and the controls do not pull in three.js. The rules are the game's, not the table's: a tile fits where the kit says it does.
import { type Coord, createRng, distinctTurns, features, type LaidTile, type Placement, type Segment, shuffle, squareEdges, tiling, type TileRules, turnEdges } from "@pbgo/engine-kit"

export type Kind = "field" | "road" | "city"
export const TILE_NAMES = ["meadow", "straight", "curve", "crossroads", "cap", "corner", "bridge", "gate"] as const
export type TileName = (typeof TILE_NAMES)[number]

/** A side of a tile has three ports, counted clockwise round the tile: on the north from the west, on the east from the north, on the south from the east, on the west from the south. A road is in the middle one, a field on each side of it. */
export const SLOTS = 3
const side = (which: number): [number, number][] => [
  [which, 0],
  [which, 1],
  [which, 2],
]
const [EAST, SOUTH, WEST, NORTH] = [0, 1, 2, 3]

export type TileDef = {
  /** What it is called, and how many of it the box holds */
  label: string
  count: number
  /** What it shows on each side, east first and clockwise: the edges the kit matches */
  edges: readonly Kind[]
  /** The parts that go from side to side, by the ports they touch: the roads, the cities and the fields that the kit joins from tile to tile */
  segments: readonly Segment<Kind>[]
}

const edges = (north: Kind, east: Kind, south: Kind, west: Kind) => squareEdges<Kind>({ north, east, south, west })

export const TILES: Record<TileName, TileDef> = {
  meadow: {
    label: "meadow",
    count: 2,
    edges: edges("field", "field", "field", "field"),
    segments: [{ kind: "field", ports: [...side(EAST), ...side(SOUTH), ...side(WEST), ...side(NORTH)] }],
  },
  straight: {
    label: "straight road",
    count: 4,
    edges: edges("road", "field", "road", "field"),
    segments: [
      {
        kind: "road",
        ports: [
          [NORTH, 1],
          [SOUTH, 1],
        ],
      },
      {
        kind: "field",
        ports: [
          [NORTH, 0],
          [WEST, 0],
          [WEST, 1],
          [WEST, 2],
          [SOUTH, 2],
        ],
      },
      {
        kind: "field",
        ports: [
          [NORTH, 2],
          [EAST, 0],
          [EAST, 1],
          [EAST, 2],
          [SOUTH, 0],
        ],
      },
    ],
  },
  curve: {
    label: "road curve",
    count: 4,
    edges: edges("field", "field", "road", "road"),
    segments: [
      {
        kind: "road",
        ports: [
          [SOUTH, 1],
          [WEST, 1],
        ],
      },
      {
        kind: "field",
        ports: [
          [SOUTH, 2],
          [WEST, 0],
        ],
      },
      { kind: "field", ports: [[SOUTH, 0], ...side(EAST), ...side(NORTH), [WEST, 2]] },
    ],
  },
  crossroads: {
    label: "crossroads",
    count: 2,
    edges: edges("field", "road", "road", "road"),
    segments: [
      { kind: "road", ports: [[EAST, 1]] },
      { kind: "road", ports: [[SOUTH, 1]] },
      { kind: "road", ports: [[WEST, 1]] },
      {
        kind: "field",
        ports: [
          ...side(NORTH),
          [EAST, 0],
          [WEST, 2],
        ],
      },
      {
        kind: "field",
        ports: [
          [EAST, 2],
          [SOUTH, 0],
        ],
      },
      {
        kind: "field",
        ports: [
          [SOUTH, 2],
          [WEST, 0],
        ],
      },
    ],
  },
  cap: {
    label: "city cap",
    count: 3,
    edges: edges("city", "field", "field", "field"),
    segments: [
      { kind: "city", ports: side(NORTH) },
      { kind: "field", ports: [...side(EAST), ...side(SOUTH), ...side(WEST)] },
    ],
  },
  corner: {
    label: "city corner",
    count: 3,
    edges: edges("city", "city", "field", "field"),
    segments: [
      { kind: "city", ports: [...side(NORTH), ...side(EAST)] },
      { kind: "field", ports: [...side(SOUTH), ...side(WEST)] },
    ],
  },
  bridge: {
    label: "city bridge",
    count: 2,
    edges: edges("city", "field", "city", "field"),
    segments: [
      { kind: "city", ports: [...side(NORTH), ...side(SOUTH)] },
      { kind: "field", ports: side(EAST) },
      { kind: "field", ports: side(WEST) },
    ],
  },
  gate: {
    label: "city gate",
    count: 3,
    edges: edges("city", "road", "field", "road"),
    segments: [
      { kind: "city", ports: side(NORTH) },
      {
        kind: "road",
        ports: [
          [EAST, 1],
          [WEST, 1],
        ],
      },
      {
        kind: "field",
        ports: [
          [EAST, 0],
          [WEST, 2],
        ],
      },
      { kind: "field", ports: [[EAST, 2], [WEST, 0], ...side(SOUTH)] },
    ],
  },
}

export const edgesOf = (name: TileName): readonly Kind[] => TILES[name].edges
export const segmentsOf = (name: TileName): readonly Segment<Kind>[] => TILES[name].segments

/** The tile that starts the table, laid in the middle of it */
export const START: LaidTile<TileName> = { at: [0, 0], tile: "gate", turns: 0 }
/** How far a table goes from its middle, in columns and in rows: a table has an end, and the kit's `allowed` says where */
export type Table = { columns: number; rows: number }
export const TABLE: Table = { columns: 3, rows: 2 }
export const SEED = 5
const within = ({ columns, rows }: Table) => ([col, row]: Coord) => Math.abs(col) <= columns && Math.abs(row) <= rows
const rulesOf = (table: Table): TileRules<Kind> => ({ allowed: within(table) })

/** The tiles of the box in the order they are drawn: every tile as many times as the box holds it, shuffled with the engine's own random stream, so that the same seed is the same game */
export function deal(seed: number): TileName[] {
  return shuffle(
    TILE_NAMES.flatMap((name) => Array.from({ length: TILES[name].count }, () => name)),
    createRng(seed),
  )
}

/** The box of the playground's table: the same deal every time, so the playground starts as it did */
export const BOX: TileName[] = deal(SEED)

export const landscape = (laid: readonly LaidTile<TileName>[]) => tiling<TileName, Kind>("square", laid, edgesOf)

/** Where a tile fits, and in which turns: the kit's search, on this table */
export const fitsFor = (laid: readonly LaidTile<TileName>[], name: TileName, table: Table = TABLE): Placement[] => landscape(laid).placements(edgesOf(name), rulesOf(table))

/** The cells a tile fits on as it is turned now */
export function spotsFor(laid: readonly LaidTile<TileName>[], name: TileName, turns: number, table: Table = TABLE): Coord[] {
  const grid = landscape(laid)
  const rules = rulesOf(table)
  return grid.spots().filter((at) => grid.fits(at, turnEdges(edgesOf(name), turns), rules))
}

/** The place in the box of the first tile from `from` on that fits somewhere: a tile that fits nowhere goes back in the box, as it does in the game. The size of the box when none does */
export function nextFitting(laid: readonly LaidTile<TileName>[], box: readonly TileName[], from: number, table: Table = TABLE): number {
  for (let index = from; index < box.length; index++) if (fitsFor(laid, box[index]!, table).length > 0) return index
  return box.length
}

/** What the table holds: the roads and the cities that are closed, the points they are worth (a point for each tile of a road, two for each tile of a city), and the tiles they are made of, by their place in `laid` */
export function closed(laid: readonly LaidTile<TileName>[]): { roads: number; cities: number; points: number; tiles: number[] } {
  const done = features(landscape(laid), segmentsOf, { slots: SLOTS }).filter((feature) => feature.kind !== "field" && feature.open === 0)
  const tiles = new Set<number>()
  let [roads, cities, points] = [0, 0, 0]
  for (const feature of done) {
    const made = new Set(feature.parts.map((part) => part.tile))
    made.forEach((tile) => tiles.add(tile))
    if (feature.kind === "road") {
      roads++
      points += made.size
    } else {
      cities++
      points += 2 * made.size
    }
  }
  return { roads, cities, points, tiles: [...tiles].sort((a, b) => a - b) }
}

/** What a table shows of its state: the tile in hand and how it is turned, the turns that look different, the free cells of the table and the ones the tile fits as it is turned (by their place in `spots`), every way it fits, and what is closed */
export function view(laid: readonly LaidTile<TileName>[], box: readonly TileName[], index: number, spin: number, table: Table = TABLE) {
  const name = index < box.length ? box[index]! : null
  // The turns only go up so that a tile always turns the way it was pressed; the engine counts them round
  const turns = ((spin % 4) + 4) % 4
  const spots = landscape(laid).spots().filter(within(table))
  const fitting = name ? spotsFor(laid, name, turns, table) : []
  const fits = spots.flatMap((spot, place) => (fitting.some(([col, row]) => col === spot[0] && row === spot[1]) ? [place] : []))
  return { name, turns, options: name ? distinctTurns(edgesOf(name)) : [], spots, fits, ways: name ? fitsFor(laid, box[index]!, table) : [], score: closed(laid) }
}

/** The table after the tile in hand is laid on a cell in a turn: the tiles that are laid, the place in the box of the next tile that fits, and how many tiles went back in the box on the way */
export function lay(laid: readonly LaidTile<TileName>[], box: readonly TileName[], index: number, at: Coord, turns: number, table: Table = TABLE) {
  const next = [...laid, { at, tile: box[index]!, turns }]
  const found = nextFitting(next, box, index + 1, table)
  return { laid: next, index: found, skipped: found - (index + 1) }
}
