import { describe, expect, it } from "vitest"
import { layoutRow, PLAY_ZONE_LABELS, PLAY_ZONE_MODES, searchModeOf, SLOT_COLUMNS, SLOT_MIDDLE, SLOT_ORDER } from "./play-zone"
import { QUEUE_MODE_LABELS } from "./queue"
import { MAX_SEATS } from "./tables"

const used = (cells: ReturnType<typeof layoutRow<string>>) => cells.flatMap((cell, column) => (cell ? [column] : []))

describe("the modes of the play zone", () => {
  it("are four, the two searches first, then the tournaments, and Custom on their right", () => {
    expect(PLAY_ZONE_MODES).toEqual(["normal", "ranked", "tournaments", "custom"])
  })

  it("name each mode, and the searches are named as the rest of the hub names them", () => {
    for (const mode of PLAY_ZONE_MODES) expect(PLAY_ZONE_LABELS[mode]).not.toBe("")
    expect(PLAY_ZONE_LABELS.normal).toBe(QUEUE_MODE_LABELS.normal)
    expect(PLAY_ZONE_LABELS.ranked).toBe(QUEUE_MODE_LABELS.ranked)
  })

  it("know which ones are a search", () => {
    expect(searchModeOf("normal")).toBe("normal")
    expect(searchModeOf("ranked")).toBe("ranked")
    expect(searchModeOf("custom")).toBeNull()
    expect(searchModeOf("tournaments")).toBeNull()
  })
})

describe("the row of places", () => {
  it("has a column for each seat of the largest table, so that a whole group is on one line", () => {
    expect(SLOT_COLUMNS).toBe(MAX_SEATS)
    expect(SLOT_COLUMNS).toBe(9)
  })

  it("fills from the middle outwards, one to the right and one to the left in turn", () => {
    expect(SLOT_ORDER).toEqual([4, 5, 3, 6, 2, 7, 1, 8, 0])
  })

  it("has its middle column where the visitor stands, the first one it fills", () => {
    expect(SLOT_MIDDLE).toBe(4)
    expect(SLOT_ORDER[0]).toBe(SLOT_MIDDLE)
  })

  it("puts the visitor in the middle column and the others around them", () => {
    const cells = layoutRow(["you", "ann", "bob"], 5)
    expect(cells[4]).toEqual({ person: "you" })
    expect(cells[5]).toEqual({ person: "ann" })
    expect(cells[3]).toEqual({ person: "bob" })
    expect(cells[6]).toEqual({ person: null })
    expect(cells[2]).toEqual({ person: null })
    expect(used(cells)).toEqual([2, 3, 4, 5, 6])
  })

  it("uses no column beyond the places it has", () => {
    expect(used(layoutRow(["you"], 1))).toEqual([4])
    expect(used(layoutRow(["you"], 2))).toEqual([4, 5])
    expect(used(layoutRow(["you"], 3))).toEqual([3, 4, 5])
    expect(used(layoutRow(["you"], 4))).toEqual([3, 4, 5, 6])
    expect(used(layoutRow(["you"], 9))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it("holds all nine places on one row, whatever the game is", () => {
    const cells = layoutRow(["you"], SLOT_COLUMNS)
    expect(cells).toHaveLength(9)
    expect(cells.filter((cell) => cell?.person === null)).toHaveLength(8)
  })

  it("is never smaller than the people in it, never larger than a table, and always has the visitor's place", () => {
    expect(used(layoutRow(["a", "b", "c"], 1))).toEqual([3, 4, 5])
    expect(used(layoutRow(["you"], 40))).toHaveLength(9)
    expect(used(layoutRow([], 0))).toEqual([4])
    expect(used(layoutRow([], Number.NaN))).toEqual([4])
  })

  it("leaves out a person beyond the ninth", () => {
    const people = Array.from({ length: 12 }, (_, index) => `p${index}`)
    const cells = layoutRow(people, 12)
    expect(cells.flatMap((cell) => (cell?.person ? [cell.person] : []))).toHaveLength(9)
    expect(cells[4]).toEqual({ person: "p0" })
  })
})
