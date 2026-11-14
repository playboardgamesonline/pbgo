import { describe, expect, it } from "vitest"
import { BOARD_PLACES, cellAt, cellCentres, cornerFrame, floorPads, LOOP_CELLS, neighboursOf, planOf } from "./geometry"

describe("cellCentres", () => {
  it("lays a grid of 6 by 6 centred on the board, a cell of the size apart, the first row the farthest", () => {
    const cells = cellCentres(planOf({ shape: "grid", centre: true }))
    const { x, z, size } = BOARD_PLACES.centre
    expect(cells).toHaveLength(36)
    expect(cells[1]!.x - cells[0]!.x).toBeCloseTo(size)
    expect(cells[6]!.z - cells[0]!.z).toBeCloseTo(size)
    expect(cells.reduce((sum, c) => sum + c.x, 0) / 36).toBeCloseTo(x)
    expect(cells.reduce((sum, c) => sum + c.z, 0) / 36).toBeCloseTo(z)
  })

  it("lays the 19 hexagons of radius 2 with the middle one on the board's middle", () => {
    const cells = cellCentres(planOf({ shape: "hex", centre: false }))
    expect(cells).toHaveLength(19)
    const middle = cells.find((c) => Math.hypot(c.x - BOARD_PLACES.side.x, c.z - BOARD_PLACES.side.z) < 1e-6)
    expect(middle).toBeDefined()
    const neighbours = neighboursOf("hex", cells.indexOf(middle!))
    expect(neighbours).toHaveLength(6)
    for (const n of neighbours) expect(Math.hypot(cells[n]!.x - middle!.x, cells[n]!.z - middle!.z)).toBeCloseTo(BOARD_PLACES.side.size)
  })

  it("lays the ring from the front, clockwise, each cell next to the one before and after", () => {
    const cells = cellCentres(planOf({ shape: "loop", centre: true }))
    expect(cells).toHaveLength(LOOP_CELLS)
    expect(cells[0]!.x).toBeCloseTo(BOARD_PLACES.centre.x)
    expect(cells[0]!.z).toBeGreaterThan(BOARD_PLACES.centre.z)
    expect(cells[LOOP_CELLS / 4]!.x).toBeLessThan(BOARD_PLACES.centre.x)
    expect(neighboursOf("loop", 0)).toEqual([1, LOOP_CELLS - 1])
  })
})

describe("cellAt", () => {
  it("finds the nearest cell within reach, or -1", () => {
    const cells = cellCentres(planOf({ shape: "grid", centre: false }))
    expect(cellAt(cells, { x: cells[7]!.x + 0.1, z: cells[7]!.z }, 0.45)).toBe(7)
    expect(cellAt(cells, { x: 20, z: 20 }, 0.45)).toBe(-1)
  })
})

describe("floorPads", () => {
  it("puts Hit and Stay side by side to the right of the pile with one gap between, and Deal under them", () => {
    const { hit, stay, deal } = floorPads({ x: 0, z: 0 })
    expect(stay.x - hit.x - hit.width).toBeCloseTo(0.3)
    expect(hit.x - hit.width / 2).toBeGreaterThan(0)
    expect(deal.z - deal.depth / 2).toBeGreaterThan(hit.z + hit.depth / 2)
    expect(deal.x).toBeCloseTo((hit.x + stay.x) / 2)
  })
})

describe("cornerFrame", () => {
  it("is as wide as the room at the bottom left, never wider than the most, and scales with it", () => {
    const wide = cornerFrame({ x: -12, z: 8 }, { x: 0, z: 8 }, { most: 9, depth: 3.4 })
    expect(wide.width).toBe(9)
    expect(wide.scale).toBe(1)
    expect(wide.x).toBe(-12 + 4.5)
    const narrow = cornerFrame({ x: -6, z: 8 }, { x: 0, z: 8 }, { most: 9, depth: 3.4 })
    expect(narrow.width).toBe(6)
    expect(narrow.scale).toBeCloseTo(6 / 9)
    expect(narrow.depth).toBeCloseTo(3.4 * (6 / 9))
  })
})
