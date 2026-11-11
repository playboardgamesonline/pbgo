import { describe, expect, it } from "vitest"
import { hexBoard, reachable, regionOf, shortestPath, squareBoard } from "./board"
import { cornerGraph, graph, longestTrail } from "./graph"

describe("graph", () => {
  // A map of six places: a square 0-1-2-3 with a tail 3-4-5, and a road across, 0-2
  const map = graph(6, [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [3, 4],
    [4, 5],
    [0, 2],
  ])

  it("knows its places and its roads", () => {
    expect(map.size).toBe(6)
    expect(map.edges).toHaveLength(7)
  })

  it("says which places are next to one another, in the order of their number", () => {
    expect(map.neighbours(0)).toEqual([1, 2, 3])
    expect(map.neighbours(3)).toEqual([0, 2, 4])
    expect(map.neighbours(5)).toEqual([4])
  })

  it("says which roads leave a place, in the order of their number", () => {
    expect(map.edgesAt(0)).toEqual([0, 3, 6])
    expect(map.edgesAt(5)).toEqual([5])
  })

  it("finds the road between two places, whichever way they are named, and -1 when there is none", () => {
    expect(map.edgeBetween(1, 2)).toBe(1)
    expect(map.edgeBetween(2, 1)).toBe(1)
    expect(map.edgeBetween(1, 3)).toBe(-1)
  })

  it("has the searches of a board go along its roads", () => {
    expect(shortestPath(map, 1, 5)).toEqual([0, 3, 4, 5])
    expect(shortestPath(map, 5, 1)).toEqual([4, 3, 0, 1])
    expect(reachable(map, 0, 1).map((r) => r.cell)).toEqual([0, 1, 2, 3])
    expect(regionOf(map, 4, (place) => place >= 3)).toEqual([3, 4, 5])
  })

  it("goes round a place that is blocked, and finds no way when there is none", () => {
    expect(shortestPath(map, 0, 4, { blocked: (place) => place === 3 })).toBeNull()
    expect(shortestPath(map, 1, 3, { blocked: (place) => place === 2 })).toEqual([0, 3])
  })

  it("has two roads between two places, a double route, each with its own number", () => {
    const double = graph(3, [
      [0, 1],
      [1, 0],
      [1, 2],
    ])
    expect(double.edgesBetween(0, 1)).toEqual([0, 1])
    expect(double.edgesBetween(1, 0)).toEqual([0, 1])
    expect(double.edgeBetween(1, 0)).toBe(0)
    expect(double.edgesBetween(0, 2)).toEqual([])
    // A place is next to another once, however many roads join them
    expect(double.neighbours(0)).toEqual([1])
    expect(double.neighbours(1)).toEqual([0, 2])
    expect(double.edgesAt(1)).toEqual([0, 1, 2])
    // A trail goes there along one road and back along the other
    expect(longestTrail(double, [0, 1])).toBe(2)
  })

  it("is a graph of no place, and of places that no road joins", () => {
    expect(graph(0, []).size).toBe(0)
    expect(graph(3, []).neighbours(1)).toEqual([])
  })

  it("refuses what is not a graph", () => {
    expect(() => graph(-1, [])).toThrow(RangeError)
    expect(() => graph(2.5, [])).toThrow(RangeError)
    expect(() => graph(3, [[0, 3]])).toThrow(RangeError)
    expect(() => graph(3, [[0, 0]])).toThrow(RangeError)
    expect(() => map.neighbours(9)).toThrow(RangeError)
    expect(() => map.edgesAt(-1)).toThrow(RangeError)
  })
})

describe("longestTrail", () => {
  // A path 0-1-2-3-4 (roads 0 to 3), a branch 2-5 (road 4), and a triangle 5-6-7 (roads 5 to 7) hanging off it
  const map = graph(8, [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [2, 5],
    [5, 6],
    [6, 7],
    [7, 5],
  ])

  it("is 0 for no road", () => {
    expect(longestTrail(map, [])).toBe(0)
  })

  it("counts the roads of a path", () => {
    expect(longestTrail(map, [0, 1, 2, 3])).toBe(4)
  })

  it("takes the longest of several trails, and the longest of a fork", () => {
    expect(longestTrail(map, [0, 1, 2, 3, 4])).toBe(4)
    // The triangle can be gone round and left by the road it was entered by: 0-1, 1-2, 2-5 (the branch), then all three of the triangle
    expect(longestTrail(map, [0, 1, 4, 5, 6, 7])).toBe(6)
  })

  it("does not count a road that is not given, and counts a road given twice once", () => {
    expect(longestTrail(map, [0, 1, 1, 1])).toBe(2)
    expect(longestTrail(map, [0, 3])).toBe(1)
  })

  it("lets a trail come back to a place and never use a road twice", () => {
    // Two triangles that share a place: 0-1-2-0 and 0-3-4-0, whose six roads make one trail
    const bow = graph(5, [
      [0, 1],
      [1, 2],
      [2, 0],
      [0, 3],
      [3, 4],
      [4, 0],
    ])
    expect(longestTrail(bow, [0, 1, 2, 3, 4, 5])).toBe(6)
  })

  it("stops at a place that is blocked, which a trail may start or end at but not go through", () => {
    // The path 0-1-2-3-4 with a settlement of another player at 2: the longest road is 2 roads on one side
    expect(longestTrail(map, [0, 1, 2, 3], { blocked: (place) => place === 2 })).toBe(2)
    expect(longestTrail(map, [0, 1, 2, 3], { blocked: (place) => place === 0 })).toBe(4)
  })

  it("adds up what each road is worth", () => {
    const worth = [4, 1, 2, 3, 5, 1, 1, 1]
    expect(longestTrail(map, [0, 1, 2, 3], { weight: (road) => worth[road]! })).toBe(10)
  })

  it("refuses a road the graph does not have, and a worth that is not a number of zero or more", () => {
    expect(() => longestTrail(map, [8])).toThrow(RangeError)
    expect(() => longestTrail(map, [-1])).toThrow(RangeError)
    expect(() => longestTrail(map, [0], { weight: () => -1 })).toThrow(RangeError)
    expect(() => longestTrail(map, [0], { weight: () => Number.NaN })).toThrow(RangeError)
  })
})

describe("cornerGraph", () => {
  it("has the corners and the sides of the island of Catan: 54 points and 72 sides for 19 hexagons", () => {
    const island = cornerGraph(hexBoard({ radius: 2 }))
    expect(island.size).toBe(54)
    expect(island.edges).toHaveLength(72)
  })

  it("has 24 points and 30 sides for seven hexagons, and 12 and 17 for squares 3 across and 2 down", () => {
    const seven = cornerGraph(hexBoard({ radius: 1 }))
    expect([seven.size, seven.edges.length]).toEqual([24, 30])
    const squares = cornerGraph(squareBoard({ columns: 3, rows: 2 }))
    expect([squares.size, squares.edges.length]).toEqual([12, 17])
  })

  it("gives every cell its own corners, in order, and the sides between them", () => {
    const board = hexBoard({ radius: 2 })
    const island = cornerGraph(board)
    for (let cell = 0; cell < board.size; cell++) {
      const points = island.pointsOf(cell)
      expect(points).toHaveLength(6)
      expect(new Set(points).size).toBe(6)
      island.sidesOf(cell).forEach((side, k) => {
        // Side k runs from corner k to corner k + 1
        expect(island.edges[side]!.slice().sort()).toEqual([points[k]!, points[(k + 1) % 6]!].sort())
        expect(island.cellsOfSide(side)).toContain(cell)
      })
    }
  })

  it("says which cells meet at a point: one to three on a hexagonal board", () => {
    const island = cornerGraph(hexBoard({ radius: 2 }))
    const meeting = Array.from({ length: island.size }, (_, point) => island.cellsAt(point).length)
    expect(Math.min(...meeting)).toBe(1)
    expect(Math.max(...meeting)).toBe(3)
    // The points inside the island are met by three cells, the points of its edge by one or two
    expect(meeting.filter((count) => count === 3)).toHaveLength(24)
  })

  it("puts one cell on a side at the edge of the board and two inside it", () => {
    const island = cornerGraph(hexBoard({ radius: 2 }))
    const counts = island.edges.map((_, side) => island.cellsOfSide(side).length)
    expect(counts.filter((count) => count === 1)).toHaveLength(30)
    expect(counts.filter((count) => count === 2)).toHaveLength(42)
  })

  it("makes every point of a hexagonal board next to two or three others", () => {
    const island = cornerGraph(hexBoard({ radius: 2 }))
    for (let point = 0; point < island.size; point++) expect([2, 3]).toContain(island.neighbours(point).length)
  })

  it("makes every point of a square board next to two, three or four others", () => {
    const squares = cornerGraph(squareBoard({ columns: 4, rows: 3 }))
    const degrees = Array.from({ length: squares.size }, (_, point) => squares.neighbours(point).length)
    expect(Math.min(...degrees)).toBe(2)
    expect(Math.max(...degrees)).toBe(4)
  })

  it("places the points on the plane, the neighbours the length of a side apart", () => {
    const island = cornerGraph(hexBoard({ radius: 2 }))
    for (const [a, b] of island.edges) {
      const [x0, z0] = island.place(a)
      const [x1, z1] = island.place(b)
      expect(Math.hypot(x1 - x0, z1 - z0)).toBeCloseTo(1 / Math.sqrt(3), 9)
    }
    const squares = cornerGraph(squareBoard({ columns: 3, rows: 3 }))
    for (const [a, b] of squares.edges) {
      const [x0, z0] = squares.place(a)
      const [x1, z1] = squares.place(b)
      expect(Math.hypot(x1 - x0, z1 - z0)).toBeCloseTo(1, 9)
    }
  })

  it("numbers the points in the order they are met, so that the first cell has the first corners", () => {
    const board = squareBoard({ columns: 2, rows: 2 })
    const corners = cornerGraph(board)
    expect(corners.pointsOf(0)).toEqual([0, 1, 2, 3])
    // The next cell shares its left side with the first
    expect(corners.pointsOf(1).slice(0, 4)).toEqual([1, 4, 5, 2])
  })

  it("has the searches of a board work on its points: the way from a corner to the other side", () => {
    const island = cornerGraph(hexBoard({ radius: 2 }))
    const far = island.size - 1
    const way = shortestPath(island, 0, far)
    expect(way).not.toBeNull()
    expect(way![way!.length - 1]).toBe(far)
    expect(reachable(island, 0, 2).length).toBeGreaterThan(3)
  })

  it("has a longest road on the sides of a board", () => {
    const island = cornerGraph(hexBoard({ radius: 2 }))
    // The six sides of the middle hexagon make a ring: a trail round it is 6 roads
    const ring = island.sidesOf(0)
    expect(longestTrail(island, ring)).toBe(6)
  })

  it("refuses a cell or a point the board does not have", () => {
    const island = cornerGraph(hexBoard({ radius: 1 }))
    expect(() => island.pointsOf(7)).toThrow(RangeError)
    expect(() => island.cellsAt(24)).toThrow(RangeError)
    expect(() => island.sidesOf(-1)).toThrow(RangeError)
    expect(() => island.cellsOfSide(30)).toThrow(RangeError)
    expect(() => island.place(24)).toThrow(RangeError)
  })

  it("is the same every time it is made", () => {
    const a = cornerGraph(hexBoard({ radius: 2 }))
    const b = cornerGraph(hexBoard({ radius: 2 }))
    expect(b.edges).toEqual(a.edges)
    expect(Array.from({ length: a.size }, (_, p) => b.place(p))).toEqual(Array.from({ length: a.size }, (_, p) => a.place(p)))
  })
})
