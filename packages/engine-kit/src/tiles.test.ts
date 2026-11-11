import { describe, expect, it } from "vitest"
import { hexBoard, squareBoard } from "./board"
import { createRng } from "./rng"
import { around, distinctTurns, features, hexEdges, type LaidTile, neighbourOf, oppositeSide, type Segment, segmentProblems, sidesOf, squareEdges, tiling, turnEdges } from "./tiles"

describe("the sides of a grid", () => {
  it("has four sides on squares and six on hexagons", () => {
    expect(sidesOf("square")).toBe(4)
    expect(sidesOf("hex")).toBe(6)
  })

  it("steps as a Board does: the cell across a side is the cell a step in that direction reaches", () => {
    const boards = [
      ["square", squareBoard({ columns: 5, rows: 5 })],
      ["hex", hexBoard({ radius: 3 })],
    ] as const
    for (const [lattice, board] of boards) {
      for (let cell = 0; cell < board.size; cell++) {
        for (let side = 0; side < sidesOf(lattice); side++) {
          const across = neighbourOf(lattice, board.coords[cell]!, side)
          const stepped = board.step(cell, side)
          if (stepped >= 0) expect(board.coords[stepped]).toEqual(across)
          else expect(board.at(across[0], across[1])).toBe(-1)
        }
      }
    }
  })

  it("says which side touches this one, and the cell across is where it comes back from", () => {
    expect([0, 1, 2, 3].map((side) => oppositeSide("square", side))).toEqual([2, 3, 0, 1])
    expect([0, 1, 2, 3, 4, 5].map((side) => oppositeSide("hex", side))).toEqual([3, 4, 5, 0, 1, 2])
    for (const lattice of ["square", "hex"] as const) {
      for (let side = 0; side < sidesOf(lattice); side++) {
        const there = neighbourOf(lattice, [3, -2], side)
        expect(neighbourOf(lattice, there, oppositeSide(lattice, side))).toEqual([3, -2])
      }
    }
  })

  it("has the cells that touch a cell: eight on squares, with the corners, in the order of a board's eight directions, and six on hexagons", () => {
    const board = squareBoard({ columns: 3, rows: 3, diagonals: true })
    const middle = board.at(1, 1)
    expect(around("square", [1, 1])).toEqual(board.neighbours(middle).map((cell) => board.coords[cell]))
    expect(around("hex", [0, 0])).toHaveLength(6)
    expect(new Set(around("hex", [0, 0]).map(([a, b]) => `${a},${b}`)).size).toBe(6)
  })

  it("refuses a side or a cell that is not one", () => {
    expect(() => neighbourOf("square", [0, 0], 4)).toThrow(RangeError)
    expect(() => neighbourOf("hex", [0, 0], -1)).toThrow(RangeError)
    expect(() => neighbourOf("square", [0.5, 0], 0)).toThrow(RangeError)
    expect(() => oppositeSide("square", 9)).toThrow(RangeError)
    expect(() => sidesOf("triangle" as never)).toThrow(RangeError)
  })
})

describe("turning a tile", () => {
  it("moves the edge of each side one side on for each turn, clockwise", () => {
    const edges = ["east", "south", "west", "north"]
    expect(turnEdges(edges, 0)).toEqual(edges)
    expect(turnEdges(edges, 1)).toEqual(["north", "east", "south", "west"])
    // A tile turned once shows on its south what it had on its east
    expect(turnEdges(edges, 1)[1]).toBe("east")
    expect(turnEdges(edges, 2)).toEqual(["west", "north", "east", "south"])
  })

  it("goes round: four turns on squares and six on hexagons are none, and a negative number turns the other way", () => {
    const edges = ["a", "b", "c", "d"]
    expect(turnEdges(edges, 4)).toEqual(edges)
    expect(turnEdges(edges, 5)).toEqual(turnEdges(edges, 1))
    expect(turnEdges(edges, -1)).toEqual(["b", "c", "d", "a"])
    const hex = [1, 2, 3, 4, 5, 6]
    expect(turnEdges(hex, 6)).toEqual(hex)
    expect(turnEdges(hex, 1)).toEqual([6, 1, 2, 3, 4, 5])
  })

  it("keeps the edges it is given and refuses what is not a turn", () => {
    const edges = ["a", "b", "c", "d"]
    turnEdges(edges, 3)
    expect(edges).toEqual(["a", "b", "c", "d"])
    expect(() => turnEdges(edges, 0.5)).toThrow(RangeError)
    expect(() => turnEdges([], 1)).toThrow(RangeError)
  })

  it("lists the turns that show a tile differently: all four, two, or one", () => {
    expect(distinctTurns(["a", "b", "c", "d"])).toEqual([0, 1, 2, 3])
    // A straight road: the same on opposite sides
    expect(distinctTurns(["field", "road", "field", "road"])).toEqual([0, 1])
    expect(distinctTurns(["a", "a", "a", "a"])).toEqual([0])
    // A corner shows in four ways, a tile that is the same on three sides in four too
    expect(distinctTurns(["city", "city", "field", "field"])).toEqual([0, 1, 2, 3])
    expect(distinctTurns(["road", "field", "field", "field"])).toEqual([0, 1, 2, 3])
    expect(distinctTurns([1, 2, 1, 2, 1, 2])).toEqual([0, 1])
    expect(distinctTurns([1, 1, 2, 1, 1, 2])).toEqual([0, 1, 2])
  })

  it("names the edges by the side they are on, and gives them in the order of the sides", () => {
    expect(squareEdges({ north: "n", east: "e", south: "s", west: "w" })).toEqual(["e", "s", "w", "n"])
    expect(hexEdges({ east: 0, southEast: 1, southWest: 2, west: 3, northWest: 4, northEast: 5 })).toEqual([0, 1, 2, 3, 4, 5])
  })
})

// A few tiles of a game of roads, cities and fields. The sides are east, south, west, north; a side has three ports counted clockwise round the tile, so that on the north the first is on the west and on the east the first is on the north
type Kind = "road" | "city" | "field"
type Def = { edges: readonly Kind[]; segments: readonly Segment<Kind>[] }
const side = (which: number): [number, number][] => [
  [which, 0],
  [which, 1],
  [which, 2],
]
const TILES: Record<string, Def> = {
  // A city on the north, fields round the rest
  cap: {
    edges: squareEdges<Kind>({ north: "city", east: "field", south: "field", west: "field" }),
    segments: [
      { kind: "city", ports: side(3) },
      { kind: "field", ports: [...side(0), ...side(1), ...side(2)] },
    ],
  },
  // A city from the north to the south
  bridge: {
    edges: squareEdges<Kind>({ north: "city", east: "field", south: "city", west: "field" }),
    segments: [
      { kind: "city", ports: [...side(3), ...side(1)] },
      { kind: "field", ports: side(0) },
      { kind: "field", ports: side(2) },
    ],
  },
  // A road from the north to the south, with a field on each side of it
  straight: {
    edges: squareEdges<Kind>({ north: "road", east: "field", south: "road", west: "field" }),
    segments: [
      {
        kind: "road",
        ports: [
          [3, 1],
          [1, 1],
        ],
      },
      {
        kind: "field",
        ports: [
          [3, 0],
          [2, 0],
          [2, 1],
          [2, 2],
          [1, 2],
        ],
      },
      {
        kind: "field",
        ports: [
          [3, 2],
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 0],
        ],
      },
    ],
  },
  // A road that turns from the south to the west
  curve: {
    edges: squareEdges<Kind>({ north: "field", east: "field", south: "road", west: "road" }),
    segments: [
      {
        kind: "road",
        ports: [
          [1, 1],
          [2, 1],
        ],
      },
      {
        kind: "field",
        ports: [
          [1, 2],
          [2, 0],
        ],
      },
      {
        kind: "field",
        ports: [[1, 0], ...side(0), ...side(3), [2, 2]],
      },
    ],
  },
  // A monastery in the middle of a field: a segment with no port
  monastery: {
    edges: squareEdges<Kind>({ north: "field", east: "field", south: "field", west: "field" }),
    segments: [
      { kind: "field", ports: [...side(0), ...side(1), ...side(2), ...side(3)] },
      { kind: "road", ports: [] },
    ],
  },
}
const edgesOf = (name: string) => TILES[name]!.edges
const segmentsOf = (name: string) => TILES[name]!.segments
const lay = (name: string, at: [number, number], turns = 0): LaidTile<string> => ({ at, tile: name, turns })
const grid = (laid: LaidTile<string>[]) => tiling<string, Kind>("square", laid, edgesOf)
const joined = (laid: LaidTile<string>[]) => features(grid(laid), segmentsOf, { slots: 3 })

describe("a tiling", () => {
  it("has one free place to begin with, the cell the first tile goes on", () => {
    const empty = grid([])
    expect(empty.spots()).toEqual([[0, 0]])
    expect(empty.bounds()).toBeNull()
    expect(empty.fits([0, 0], edgesOf("cap"))).toBe(true)
    expect(empty.fits([3, 3], edgesOf("cap"))).toBe(false)
    expect(empty.placements(edgesOf("cap")).map((place) => place.at)).toEqual([[0, 0], [0, 0], [0, 0], [0, 0]])
  })

  it("has a free place on every side of a tile, in the order of the sides, and none that is taken", () => {
    const one = grid([lay("cap", [0, 0])])
    expect(one.spots()).toEqual([
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ])
    const two = grid([lay("cap", [0, 0]), lay("cap", [1, 0], 2)])
    expect(two.spots()).toEqual([
      [0, 1],
      [-1, 0],
      [0, -1],
      [2, 0],
      [1, 1],
      [1, -1],
    ])
    expect(two.at([1, 0])).toBe(1)
    expect(two.at([5, 5])).toBe(-1)
    expect(two.bounds()).toEqual({ min: [0, 0], max: [1, 0] })
  })

  it("tells what a laid tile shows on a side, turned as it was laid", () => {
    const one = grid([lay("cap", [0, 0], 1)])
    // A city on the north, turned once, is on the east
    expect(one.edge([0, 0], 0)).toBe("city")
    expect(one.edge([0, 0], 3)).toBe("field")
    expect(one.edge([4, 4], 0)).toBeUndefined()
  })

  it("refuses two tiles on a cell, and edges that are not as many as the sides", () => {
    expect(() => grid([lay("cap", [0, 0]), lay("cap", [0, 0])])).toThrow(RangeError)
    expect(() => tiling("hex", [lay("cap", [0, 0])], edgesOf)).toThrow(RangeError)
    expect(() => grid([]).fits([0, 0], ["field"])).toThrow(RangeError)
    expect(() => grid([lay("cap", [0.5, 0])])).toThrow(RangeError)
  })

  it("lets a tile lie against a tile only where each side that touches one matches", () => {
    const one = grid([lay("cap", [0, 0])])
    // The cap has its city on the north, so a tile to the north must show a city on its south
    expect(one.fits([0, -1], turnEdges(edgesOf("cap"), 2))).toBe(true)
    expect(one.fits([0, -1], edgesOf("cap"))).toBe(false)
    // To the east, field against field
    expect(one.fits([1, 0], edgesOf("cap"))).toBe(true)
    expect(one.fits([1, 0], turnEdges(edgesOf("straight"), 1))).toBe(false)
    // Not on a tile, not away from the tiles
    expect(one.fits([0, 0], edgesOf("cap"))).toBe(false)
    expect(one.fits([5, 5], edgesOf("monastery"))).toBe(false)
  })

  it("checks every side that touches, not only the first", () => {
    // A cap at the origin and a cap turned to look at it from the east: a cell above the east one touches only that one
    const two = grid([lay("cap", [0, 0]), lay("cap", [2, 0], 2)])
    // The cell between them touches both: field on the east of the first, field on the west of the second
    expect(two.fits([1, 0], edgesOf("monastery"))).toBe(true)
    // A city on its east would not match the first tile
    expect(two.fits([1, 0], squareEdges<Kind>({ north: "field", east: "field", south: "field", west: "city" }))).toBe(false)
    expect(two.fits([1, 0], squareEdges<Kind>({ north: "field", east: "city", south: "field", west: "field" }))).toBe(false)
  })

  it("follows the rules the game gives: edges that go together by its own measure, and the cells that are allowed", () => {
    const one = grid([lay("cap", [0, 0])])
    // A game where a road also goes with a field
    const lenient = { matches: (laid: Kind, against: Kind) => laid === against || (laid !== "city" && against !== "city") }
    expect(one.fits([1, 0], edgesOf("straight"), lenient)).toBe(true)
    // A table that has an end
    const small = { allowed: ([col]: readonly [number, number]) => col <= 1 }
    expect(one.fits([1, 0], edgesOf("cap"), small)).toBe(true)
    expect(grid([lay("cap", [1, 0])]).fits([2, 0], edgesOf("cap"), small)).toBe(false)
    expect(grid([lay("cap", [1, 0])]).placements(edgesOf("monastery"), small).every(({ at }) => at[0] <= 1)).toBe(true)
  })

  it("lists every way a tile fits, the places in order and the turns from 0, a turn that shows the same once", () => {
    const one = grid([lay("cap", [0, 0])])
    // A straight road shows two ways, so at each place where it fits it may be laid two ways at the most
    const ways = one.placements(edgesOf("straight"))
    // Field against the east, south and west of the cap: the road must run along the side, so the road runs north-south or east-west, fields facing the cap
    expect(ways).toEqual([
      { at: [1, 0], turns: 0 },
      { at: [0, 1], turns: 1 },
      { at: [-1, 0], turns: 0 },
    ])
    // A cap fits against the north only with its city to the south, and at the other places in the turns that keep a field facing the cap
    expect(one.placements(edgesOf("cap")).map(({ at, turns }) => `${at}@${turns}`)).toEqual(["1,0@0", "1,0@1", "1,0@2", "0,1@1", "0,1@2", "0,1@3", "-1,0@0", "-1,0@2", "-1,0@3", "0,-1@2"])
  })

  it("finds in a loop of roads where every next tile goes, and the loop closes", () => {
    // Four curves round the corner of four cells: each turned so that its road faces the cells that touch it
    let laid: LaidTile<string>[] = [lay("curve", [0, 0], 3)]
    const want: [string, [number, number], number][] = [
      ["curve", [1, 0], 0],
      ["curve", [0, 1], 2],
      ["curve", [1, 1], 1],
    ]
    for (const [name, at, turns] of want) {
      const ways = grid(laid).placements(edgesOf(name))
      expect(ways).toContainEqual({ at, turns })
      laid = [...laid, lay(name, at, turns)]
    }
    const [loop] = joined(laid).filter((feature) => feature.kind === "road")
    expect(loop!.parts.map((part) => part.tile)).toEqual([0, 1, 2, 3])
    expect(loop!.open).toBe(0)
  })

  it("agrees with trying every cell and every turn, whatever the layout", () => {
    const names = Object.keys(TILES)
    const rng = createRng(11)
    for (let game = 0; game < 12; game++) {
      let laid: LaidTile<string>[] = [lay(names[Math.floor(rng() * names.length)]!, [0, 0], Math.floor(rng() * 4))]
      for (let step = 0; step < 14; step++) {
        const now = grid(laid)
        const name = names[Math.floor(rng() * names.length)]!
        const edges = edgesOf(name)
        const ways = now.placements(edges)
        // The same places by brute force: every free cell round the layout, every turn, the first of the turns that look alike
        const box = now.bounds()!
        const expected = new Set<string>()
        for (let col = box.min[0] - 1; col <= box.max[0] + 1; col++) {
          for (let row = box.min[1] - 1; row <= box.max[1] + 1; row++) {
            if (now.at([col, row]) >= 0) continue
            const seen = new Set<string>()
            for (let turn = 0; turn < 4; turn++) {
              const shown = turnEdges(edges, turn)
              if (seen.has(shown.join()) || !now.fits([col, row], shown)) continue
              seen.add(shown.join())
              expected.add(`${col},${row}@${turn}`)
            }
          }
        }
        expect(new Set(ways.map(({ at, turns }) => `${at}@${turns}`))).toEqual(expected)
        // Never on a tile, never twice
        expect(ways.every(({ at }) => now.at(at) < 0)).toBe(true)
        expect(new Set(ways.map(({ at, turns }) => `${at}@${turns}`)).size).toBe(ways.length)
        if (ways.length === 0) continue
        const pick = ways[Math.floor(rng() * ways.length)]!
        laid = [...laid, lay(name, [pick.at[0], pick.at[1]], pick.turns)]
      }
      // Every pair of tiles that touch match on the sides that touch
      const done = grid(laid)
      for (const one of laid) {
        for (let side = 0; side < 4; side++) {
          const across = neighbourOf("square", one.at, side)
          const other = done.edge(across, oppositeSide("square", side))
          if (other !== undefined) expect(other).toBe(done.edge(one.at, side))
        }
      }
    }
  })

  it("works on hexagons: six places round a tile, and a tile fits where the sides across match", () => {
    const edgesHex = (name: string): readonly string[] => (name === "road" ? hexEdges({ east: "road", southEast: "field", southWest: "field", west: "road", northWest: "field", northEast: "field" }) : hexEdges({ east: "field", southEast: "field", southWest: "field", west: "field", northWest: "field", northEast: "field" }))
    const one = tiling<string, string>("hex", [{ at: [0, 0], tile: "road", turns: 0 }], edgesHex)
    expect(one.spots()).toHaveLength(6)
    // East of the road the tile must show a road on its west
    expect(one.fits([1, 0], edgesHex("road"))).toBe(true)
    expect(one.fits([1, 0], edgesHex("field"))).toBe(false)
    // A road on a hexagon is the same after three turns
    expect(distinctTurns(edgesHex("road"))).toEqual([0, 1, 2])
    // Against the road on the east and the west nothing but a road goes, so a field goes on the other four sides
    expect(one.placements(edgesHex("field")).map(({ at }) => at)).toEqual([
      [0, 1],
      [-1, 1],
      [0, -1],
      [1, -1],
    ])
  })
})

describe("features", () => {
  it("is nothing for no tile, and a feature for each segment of a tile that is alone, all open", () => {
    expect(joined([])).toEqual([])
    const [city, field] = joined([lay("cap", [0, 0])])
    expect(city).toEqual({ kind: "city", parts: [{ tile: 0, segment: 0 }], open: 1 })
    expect(field).toEqual({ kind: "field", parts: [{ tile: 0, segment: 1 }], open: 3 })
  })

  it("joins a road from tile to tile, and counts the sides where it can still go on", () => {
    const found = joined([lay("straight", [0, 0]), lay("straight", [0, 1])])
    const roads = found.filter((feature) => feature.kind === "road")
    expect(roads).toEqual([
      {
        kind: "road",
        parts: [
          { tile: 0, segment: 0 },
          { tile: 1, segment: 0 },
        ],
        open: 2,
      },
    ])
  })

  it("does not join a field across a road: each side of the road is its own field, and they go on along it", () => {
    const fields = joined([lay("straight", [0, 0]), lay("straight", [0, 1])]).filter((feature) => feature.kind === "field")
    expect(fields).toHaveLength(2)
    for (const field of fields) expect(field.parts.map((part) => part.tile)).toEqual([0, 1])
    // The west field is open at the north of the first tile and at the west and the south of the second, and at the west of the first
    expect(fields.map((field) => field.open)).toEqual([4, 4])
  })

  it("closes a city when its tiles meet and nothing faces an empty cell", () => {
    const closed = joined([lay("cap", [0, 0]), lay("cap", [0, -1], 2)]).filter((feature) => feature.kind === "city")
    expect(closed).toEqual([
      {
        kind: "city",
        parts: [
          { tile: 0, segment: 0 },
          { tile: 1, segment: 0 },
        ],
        open: 0,
      },
    ])
    // Three tiles, the same city, and it stays closed
    const three = joined([lay("bridge", [0, 0]), lay("cap", [0, -1], 2), lay("cap", [0, 1])]).filter((feature) => feature.kind === "city")
    expect(three).toHaveLength(1)
    expect(three[0]!.parts).toHaveLength(3)
    expect(three[0]!.open).toBe(0)
    // Take one cap away and the city is open on one side
    const open = joined([lay("bridge", [0, 0]), lay("cap", [0, -1], 2)]).filter((feature) => feature.kind === "city")
    expect(open[0]!.open).toBe(1)
  })

  it("follows the turns of the tiles", () => {
    // Two straights turned to run east to west
    const road = joined([lay("straight", [0, 0], 1), lay("straight", [1, 0], 1)]).filter((feature) => feature.kind === "road")
    expect(road).toHaveLength(1)
    expect(road[0]!.parts).toHaveLength(2)
    expect(road[0]!.open).toBe(2)
    // One turned and one not do not meet: the road of the second runs north to south
    const apart = joined([lay("straight", [0, 0], 1), lay("straight", [1, 0])]).filter((feature) => feature.kind === "road")
    expect(apart).toHaveLength(2)
  })

  it("does not join what is not of one kind, and a side against another kind is not open", () => {
    // The road of the first tile meets a city: nothing joins, and the south of the road is not an open end
    const found = joined([lay("straight", [0, 0]), lay("cap", [0, 1])])
    const road = found.find((feature) => feature.kind === "road")!
    expect(road.parts).toEqual([{ tile: 0, segment: 0 }])
    expect(road.open).toBe(1)
  })

  it("keeps a segment with no port alone, closed", () => {
    const found = joined([lay("monastery", [0, 0])])
    expect(found.find((feature) => feature.kind === "road")).toEqual({ kind: "road", parts: [{ tile: 0, segment: 1 }], open: 0 })
  })

  it("comes in the order of the first part of each", () => {
    const found = joined([lay("straight", [0, 0]), lay("cap", [1, 0], 3), lay("monastery", [0, 1])])
    const firsts = found.map((feature) => feature.parts[0]!)
    for (let i = 1; i < firsts.length; i++) {
      const [before, after] = [firsts[i - 1]!, firsts[i]!]
      expect(before.tile < after.tile || (before.tile === after.tile && before.segment < after.segment)).toBe(true)
    }
  })

  it("joins on hexagons, one port to a side by default", () => {
    const path = [{ kind: "path", ports: [[0, 0], [3, 0]] }] as const
    const hexGrid = tiling<string, string>("hex", [{ at: [0, 0], tile: "p", turns: 0 }, { at: [1, 0], tile: "p", turns: 0 }, { at: [2, 0], tile: "p", turns: 3 }], () => hexEdges({ east: "x", southEast: "x", southWest: "x", west: "x", northWest: "x", northEast: "x" }))
    const found = features(hexGrid, () => path)
    expect(found).toEqual([{ kind: "path", parts: [{ tile: 0, segment: 0 }, { tile: 1, segment: 0 }, { tile: 2, segment: 0 }], open: 2 }])
  })

  it("refuses ports that are not there, and two segments on one port", () => {
    const bad = (segments: Segment[]) => features(grid([lay("cap", [0, 0])]), () => segments, { slots: 3 })
    expect(() => bad([{ kind: "x", ports: [[4, 0]] }])).toThrow(RangeError)
    expect(() => bad([{ kind: "x", ports: [[0, 3]] }])).toThrow(RangeError)
    expect(() =>
      bad([
        { kind: "x", ports: [[0, 0]] },
        { kind: "y", ports: [[0, 0]] },
      ]),
    ).toThrow(RangeError)
    expect(() => features(grid([]), () => [], { slots: 0 })).toThrow(RangeError)
  })
})

describe("segmentProblems", () => {
  it("finds nothing wrong with tiles whose segments hold every port once", () => {
    for (const name of Object.keys(TILES)) expect(segmentProblems("square", segmentsOf(name), { slots: 3 })).toEqual([])
    expect(segmentProblems("hex", [{ kind: "path", ports: [[0, 0], [3, 0]] }], { slots: 1, complete: false })).toEqual([])
  })

  it("names a port that no segment holds, a port two segments hold, and a port that is not on the tile", () => {
    const [kept, ...rest] = TILES.cap!.segments
    expect(segmentProblems("square", [kept!], { slots: 3 })).toEqual(["No segment holds port 0 of side 0", "No segment holds port 1 of side 0", "No segment holds port 2 of side 0", "No segment holds port 0 of side 1", "No segment holds port 1 of side 1", "No segment holds port 2 of side 1", "No segment holds port 0 of side 2", "No segment holds port 1 of side 2", "No segment holds port 2 of side 2"])
    expect(segmentProblems("square", [kept!, ...rest], { slots: 3 })).toEqual([])
    expect(segmentProblems("square", [{ kind: "a", ports: [[0, 0]] }, { kind: "b", ports: [[0, 0]] }], { slots: 1 })).toEqual(["Segments 0 and 1 both hold port 0 of side 0", "No segment holds port 0 of side 1", "No segment holds port 0 of side 2", "No segment holds port 0 of side 3"])
    expect(segmentProblems("square", [{ kind: "a", ports: [[4, 0], [0, 2]] }], { slots: 2, complete: false })).toEqual(["Segment 0 has port 0 of side 4, which is not on the tile", "Segment 0 has port 2 of side 0, which is not on the tile"])
  })

  it("does not ask for every port when it is told the segments are partial", () => {
    expect(segmentProblems("square", [{ kind: "a", ports: [[0, 0]] }], { slots: 1, complete: false })).toEqual([])
  })
})
