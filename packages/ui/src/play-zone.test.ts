import { describe, expect, it } from "vitest"
import { GAME_SLOT_BASE, gameSlotsFor, layoutRow, PLAY_ZONE_LABELS, PLAY_ZONE_MODES, placesFor, searchModeOf, SLOT_BASE, SLOT_COLUMNS } from "./play-zone"
import { QUEUE_MODE_LABELS } from "./queue"
import { MAX_SEATS } from "./tables"

const people = (cells: ReturnType<typeof layoutRow<string>>) => cells.map((cell) => cell.person)

describe("the modes of the play zone", () => {
  it("are three, the two searches first and Custom on their right: the tournaments are not a mode", () => {
    expect(PLAY_ZONE_MODES).toEqual(["normal", "ranked", "custom"])
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
  })
})

describe("the row of places", () => {
  it("has at most a place for each seat of the largest table, so that a whole group is on one line", () => {
    expect(SLOT_COLUMNS).toBe(MAX_SEATS)
    expect(SLOT_COLUMNS).toBe(9)
  })

  it("holds the visitor in the first place, then the others in the order they are given, then the free places", () => {
    expect(people(layoutRow(["you", "ann", "bob"], 5))).toEqual(["you", "ann", "bob", null, null])
    expect(people(layoutRow(["you"], 3))).toEqual(["you", null, null])
  })

  it("has exactly the places it is asked for, from one to nine", () => {
    for (const size of [1, 2, 3, 5, 6, 9]) expect(layoutRow(["you"], size)).toHaveLength(size)
  })

  it("holds all nine places on one row, whatever the game is", () => {
    const cells = layoutRow(["you"], SLOT_COLUMNS)
    expect(cells).toHaveLength(9)
    expect(cells.filter((cell) => cell.person === null)).toHaveLength(8)
  })

  it("is never smaller than the people in it, never larger than a table, and always has the visitor's place", () => {
    expect(layoutRow(["a", "b", "c"], 1)).toHaveLength(3)
    expect(layoutRow(["you"], 40)).toHaveLength(9)
    expect(layoutRow([], 0)).toHaveLength(1)
    expect(layoutRow([], Number.NaN)).toHaveLength(1)
  })

  it("leaves out a person beyond the ninth", () => {
    const names = Array.from({ length: 12 }, (_, index) => `p${index}`)
    const cells = layoutRow(names, 12)
    expect(cells).toHaveLength(9)
    expect(cells[0]).toEqual({ person: "p0" })
    expect(cells[8]).toEqual({ person: "p8" })
  })
})

describe("how many places the row of a group has", () => {
  it("has all nine from the start, the most a table holds, however few people are in it", () => {
    expect(SLOT_BASE).toBe(SLOT_COLUMNS)
    expect(SLOT_BASE).toBe(9)
    for (const people of [0, 1, 2, 3, 4, 5, 8]) expect(placesFor(people)).toBe(9)
  })

  it("never has more places than a table holds, so a full group has no free place", () => {
    expect(placesFor(9)).toBe(9)
    expect(placesFor(40)).toBe(9)
  })

  it("keeps a free place while there is room, and the visitor in the first place", () => {
    for (let count = 1; count < SLOT_COLUMNS; count++) {
      const cells = layoutRow(Array.from({ length: count }, (_, index) => `p${index}`), placesFor(count))
      expect(cells.filter((cell) => cell.person === null).length).toBeGreaterThan(0)
      expect(cells[0]).toEqual({ person: "p0" })
    }
  })

  it("is not thrown by a count that is not a whole number", () => {
    expect(placesFor(Number.NaN)).toBe(9)
    expect(placesFor(5.9)).toBe(9)
  })
})

describe("how many slots the row of games of a search has", () => {
  const MOST = 12

  it("has twelve from the start, two rows of six, the games that are picked and the free slots after them, however few games are picked", () => {
    expect(GAME_SLOT_BASE).toBe(12)
    for (const games of [0, 1, 2, 5, 11]) expect(gameSlotsFor(games, MOST)).toBe(12)
  })

  it("never has more slots than a search takes games, so a full row has no free slot", () => {
    expect(gameSlotsFor(12, MOST)).toBe(12)
    expect(gameSlotsFor(40, MOST)).toBe(12)
  })

  it("keeps a free slot while the search can take another game", () => {
    for (let games = 0; games < MOST; games++) expect(gameSlotsFor(games, MOST) - games).toBeGreaterThan(0)
    expect(gameSlotsFor(MOST, MOST) - MOST).toBe(0)
  })

  it("has no more slots than a search takes when that is fewer than the base", () => {
    expect(gameSlotsFor(0, 8)).toBe(8)
  })

  it("is not thrown by a count that is not a whole number", () => {
    expect(gameSlotsFor(Number.NaN, MOST)).toBe(12)
    expect(gameSlotsFor(5.9, MOST)).toBe(12)
  })
})
