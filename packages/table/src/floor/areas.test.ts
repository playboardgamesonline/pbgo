import { describe, expect, it } from "vitest"
import { cornersOfBox, polygonsOverlap, type TableBox } from "../box"
import { type AreaSeed, cornersOfArea, growAreas, growBox, hotspotOf, padBox } from "./areas"

const FRAME = { x: 0, z: 0, yaw: 0 }
const CORE: TableBox = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }
const quad = (minX: number, maxX: number, minZ: number, maxZ: number) => cornersOfBox({ minX, maxX, minZ, maxZ }, { x: 0, z: 0 })

describe("hotspotOf", () => {
  it("stands in the middle of the box, as wide and as deep as it", () => {
    const { at, width, depth } = hotspotOf({ frame: { x: 0, z: 0 }, box: { minX: -2, maxX: 4, minZ: 1, maxZ: 3 } })
    expect(at).toEqual({ x: 1, z: 2, yaw: 0 })
    expect(width).toBe(6)
    expect(depth).toBe(2)
  })

  it("turns the middle with the frame of its seat and takes the way the frame faces", () => {
    const frame = { x: 10, z: 0, yaw: Math.PI / 2 }
    const { at } = hotspotOf({ frame, box: { minX: -1, maxX: 1, minZ: 2, maxZ: 4 } })
    // the middle of the box is 3 along the axis of the seat, which a quarter turn lays along the x of the table
    expect(at.yaw).toBe(Math.PI / 2)
    expect(at.x).toBeCloseTo(13, 10)
    expect(at.z).toBeCloseTo(0, 10)
  })

  it("covers, on the table, the corners that the area says", () => {
    const area = { frame: { x: 4, z: -2, yaw: 0.6 }, box: { minX: -2, maxX: 3, minZ: 0, maxZ: 2 } }
    const { at } = hotspotOf(area)
    const corners = cornersOfArea(area)
    expect(corners.reduce((sum, corner) => sum + corner.x, 0) / 4).toBeCloseTo(at.x, 10)
    expect(corners.reduce((sum, corner) => sum + corner.z, 0) / 4).toBeCloseTo(at.z, 10)
  })
})

describe("padBox", () => {
  it("grows each side by its own amount: left, right, toward the middle of the table, away from it", () => {
    expect(padBox(CORE, [1, 2, 3, 4])).toEqual({ minX: -2, maxX: 3, minZ: -4, maxZ: 5 })
  })
})

describe("growBox", () => {
  it("grows a core by its padding on every side when nothing is near", () => {
    expect(growBox(CORE, FRAME, [], 0.5)).toEqual({ minX: -1.5, maxX: 1.5, minZ: -1.5, maxZ: 1.5 })
  })

  it("stops short of what lies in the way, on that side only", () => {
    // a wall 0.3 from the right of the core: the right side gives back until a hair is left, the others keep all of their padding
    const box = growBox(CORE, FRAME, [quad(1.3, 3, -5, 5)], 0.5)
    expect(box.maxX).toBeGreaterThan(1)
    expect(box.maxX).toBeLessThanOrEqual(1.3 - 0.02 + 1e-9)
    expect(box.minX).toBe(-1.5)
    expect(box.minZ).toBe(-1.5)
    expect(box.maxZ).toBe(1.5)
  })

  it("does not grow toward a thing that the core already touches", () => {
    const box = growBox(CORE, FRAME, [quad(1, 3, -5, 5)], 0.5)
    expect(box.maxX).toBe(1)
    expect(box.minX).toBe(-1.5)
  })

  it("gives back at the corners what each side could keep alone, until nothing is touched", () => {
    // a block at the corner: neither side meets it alone, the two together do
    const corner = quad(1.2, 1.6, 1.2, 1.6)
    const box = growBox(CORE, FRAME, [corner], 0.5)
    expect(polygonsOverlap(cornersOfBox(box, FRAME), corner)).toBe(false)
    expect(box.maxX).toBeGreaterThan(1)
    expect(box.maxZ).toBeGreaterThan(1)
    expect(box.maxX).toBeLessThan(1.5)
    expect(box.maxZ).toBeLessThan(1.5)
    // all four sides give back together, the ones away from the block too: the area stays whole and a little smaller everywhere
    expect(box.minX).toBeGreaterThan(-1.5)
    expect(box.minX).toBeLessThan(-1)
  })

  it("keeps the area turned with its seat: what is in the way is measured on the table", () => {
    // the seat is turned a quarter: its right (x of the frame) is the table's -z
    const turned = { x: 0, z: 0, yaw: Math.PI / 2 }
    const wall = quad(-5, 5, -3, -1.3)
    const box = growBox(CORE, turned, [wall], 0.5)
    expect(polygonsOverlap(cornersOfBox(box, turned), wall)).toBe(false)
    expect(box.minX).toBe(-1.5)
    expect(box.maxX).toBeGreaterThan(1)
    expect(box.maxX).toBeLessThan(1.5)
  })
})

describe("growAreas", () => {
  const seed = (x: number, core: TableBox = CORE, plate?: TableBox): AreaSeed => ({ frame: { x, z: 0, yaw: 0 }, core: () => core, avoid: [], ...(plate ? { plate } : {}) })

  it("gives a seat that is alone all of its padding", () => {
    const areas = growAreas(new Map([["a", seed(0)]]), 0.5)
    expect(areas.get("a")!.box).toEqual({ minX: -1.5, maxX: 1.5, minZ: -1.5, maxZ: 1.5 })
    expect(areas.get("a")!.frame).toEqual({ x: 0, z: 0, yaw: 0 })
  })

  it("gives back the padding of two neighbours until they only touch, the same for both when they are alike", () => {
    // cores 2 apart (their frames stand 4 apart): padded by 1.5 the areas would overlap by 2
    const areas = growAreas(
      new Map([
        ["a", seed(-2)],
        ["b", seed(2)],
      ]),
      1.5,
    )
    const [a, b] = [areas.get("a")!, areas.get("b")!]
    expect(polygonsOverlap(cornersOfArea(a), cornersOfArea(b))).toBe(false)
    for (const area of [a, b]) {
      // never smaller than what it must hold, and some padding is left
      expect(area.box.minX).toBeLessThan(CORE.minX)
      expect(area.box.maxX).toBeGreaterThan(CORE.maxX)
    }
    expect(a.box.maxX - a.box.minX).toBeCloseTo(b.box.maxX - b.box.minX, 10)
  })

  it("asks the core again for the share of padding that is left", () => {
    const shares: number[] = []
    const crowded: AreaSeed = { frame: { x: -2, z: 0, yaw: 0 }, core: (share) => (shares.push(share), CORE), avoid: [] }
    growAreas(new Map<string, AreaSeed>([["a", crowded], ["b", seed(2)]]), 1.5)
    expect(shares[0]).toBe(1)
    expect(Math.min(...shares)).toBeLessThan(1)
  })

  it("narrows toward the axis of a seat that has no padding to give, and never below its plate", () => {
    // two seats whose cores overlap by 1: with no padding to give, the areas narrow until they touch
    const wide: TableBox = { minX: -2, maxX: 2, minZ: -1, maxZ: 1 }
    const plate: TableBox = { minX: -0.6, maxX: 0.6, minZ: -1, maxZ: 0 }
    const touching = growAreas(
      new Map([
        ["a", seed(-1.5, wide, plate)],
        ["b", seed(1.5, wide, plate)],
      ]),
      0,
    )
    const [a, b] = [touching.get("a")!, touching.get("b")!]
    expect(polygonsOverlap(cornersOfArea(a), cornersOfArea(b))).toBe(false)
    expect(a.box.maxX - a.box.minX).toBeGreaterThanOrEqual(1.2 - 1e-9)
    // a plate that is as wide as the core leaves nothing to narrow: the area stays as wide as the plate
    const stuck = growAreas(
      new Map([
        ["a", seed(-1.5, wide, wide)],
        ["b", seed(1.5, wide, wide)],
      ]),
      0,
    )
    expect(stuck.get("a")!.box.maxX - stuck.get("a")!.box.minX).toBeCloseTo(4, 10)
  })

  it("gives the same areas for the same seats every time", () => {
    const seeds = () => new Map([["a", seed(-2)], ["b", seed(2)]])
    expect(growAreas(seeds(), 1.5)).toEqual(growAreas(seeds(), 1.5))
  })
})
