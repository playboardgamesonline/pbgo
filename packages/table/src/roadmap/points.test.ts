import { describe, expect, it } from "vitest"
import { hexBoard, squareBoard } from "../../../engine-kit/src/board"
import { cornerGraph } from "../../../engine-kit/src/graph"
import { hexCells, squareCells } from "../board/cells"
import { edgePlace, hexPoints, squarePoints } from "./points"

// The points of the table are the corners of the engine's `cornerGraph`, in its order: a test holds the two together, since the table does not import the kit
const AT = { x: 3, z: -2 }
const SIZE = 1.6

describe("hexPoints and squarePoints against the kit's cornerGraph", () => {
  const cases = [
    { name: "an island of 19 hexagons", board: hexBoard({ radius: 2 }), points: hexPoints, cells: hexCells, spacing: SIZE / Math.sqrt(3) },
    { name: "a rectangle of hexagons", board: hexBoard({ columns: 4, rows: 3 }), points: hexPoints, cells: hexCells, spacing: SIZE / Math.sqrt(3) },
    { name: "a board of squares", board: squareBoard({ columns: 4, rows: 3 }), points: squarePoints, cells: squareCells, spacing: SIZE },
  ]
  for (const { name, board, points, cells, spacing } of cases) {
    describe(name, () => {
      const corners = cornerGraph(board)
      const here = points(board.coords, { size: SIZE, at: AT })

      it("has one place for each point of the graph", () => {
        expect(here).toHaveLength(corners.size)
      })

      it("puts the two ends of every side the length of a side apart, which only holds when the numbers agree", () => {
        for (const [a, b] of corners.edges) expect(Math.hypot(here[a]!.x - here[b]!.x, here[a]!.z - here[b]!.z)).toBeCloseTo(spacing, 9)
      })

      it("keeps every distance of the kit's places, times the size", () => {
        for (let a = 0; a < corners.size; a += 3) {
          for (let b = a + 1; b < corners.size; b += 5) {
            const [ax, az] = corners.place(a)
            const [bx, bz] = corners.place(b)
            expect(Math.hypot(here[a]!.x - here[b]!.x, here[a]!.z - here[b]!.z)).toBeCloseTo(SIZE * Math.hypot(ax - bx, az - bz), 9)
          }
        }
      })

      it("lies round the cells of the table: the middle of a cell is the middle of its corners", () => {
        const placed = cells(board.coords, { size: SIZE, at: AT })
        for (let cell = 0; cell < board.size; cell++) {
          const mine = corners.pointsOf(cell).map((point) => here[point]!)
          const middle = { x: mine.reduce((sum, p) => sum + p.x, 0) / mine.length, z: mine.reduce((sum, p) => sum + p.z, 0) / mine.length }
          expect(middle.x).toBeCloseTo(placed[cell]!.x, 9)
          expect(middle.z).toBeCloseTo(placed[cell]!.z, 9)
        }
      })

      it("keeps the corners of a cell in the order of the corners of the cell of the table", () => {
        const placed = cells(board.coords, { size: SIZE, at: AT })
        const cell = Math.floor(board.size / 2)
        corners.pointsOf(cell).forEach((point, k) => {
          // The corner of the cell of the table is inset by a gap of 0: it is the same place
          expect(here[point]!.x).toBeCloseTo(placed[cell]!.x + placed[cell]!.corners[k]![0], 9)
          expect(here[point]!.z).toBeCloseTo(placed[cell]!.z + placed[cell]!.corners[k]![1], 9)
        })
      })
    })
  }

  it("is centred on `at` like the cells: the box round the middles of the cells has its middle there", () => {
    const board = squareBoard({ columns: 3, rows: 3 })
    const placed = squareCells(board.coords, { size: 2, at: AT })
    const xs = placed.map((cell) => cell.x)
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(AT.x, 9)
    const around = squarePoints(board.coords, { size: 2, at: AT })
    const px = around.map((p) => p.x)
    expect((Math.min(...px) + Math.max(...px)) / 2).toBeCloseTo(AT.x, 9)
  })

  it("is none for no cell, and refuses a size that is not above zero", () => {
    expect(hexPoints([], { size: 1 })).toEqual([])
    expect(() => squarePoints([[0, 0]], { size: 0 })).toThrow(RangeError)
    expect(() => hexPoints([[0, 0]], { size: Number.NaN })).toThrow(RangeError)
  })
})

describe("edgePlace", () => {
  it("is the middle of the road, the way it runs and its length", () => {
    expect(edgePlace({ x: 0, z: 0 }, { x: 2, z: 0 })).toEqual({ x: 1, z: 0, yaw: 0, length: 2 })
  })

  it("turns a road that runs toward the viewer a quarter turn, so that a piece long along its own x lies along it", () => {
    const toward = edgePlace({ x: 1, z: 1 }, { x: 1, z: 4 })
    expect(toward.length).toBe(3)
    expect(toward.yaw).toBeCloseTo(-Math.PI / 2, 12)
    // A Three.js rotation by `yaw` about the vertical axis takes the x axis to (cos yaw, 0, -sin yaw)
    expect([Math.cos(toward.yaw), -Math.sin(toward.yaw)].map((v) => Math.round(v))).toEqual([0, 1])
  })
})
