import { describe, expect, it } from "vitest"
import { DEMO_ARTICLE, demoTournaments, HOME_TOURNAMENTS, openTournaments, pagesOf, perPageFor, ROW_GAP, TOURNAMENTS_PER_PAGE_MAX, type AsideGame } from "./home-aside"

const game = (slug: string): AsideGame => ({ slug, name: slug.toUpperCase() })
const tournament = (id: string, startsAt: string, status: "upcoming" | "live" | "finished" = "upcoming") => ({ id, name: id, status, startsAt, places: 16, registered: 4 })

describe("the open tournaments of the home", () => {
  it("are the ones that can still be signed up to, the ones that start first, each with its game", () => {
    const list = openTournaments([
      { game: game("a"), tournaments: [tournament("a-late", "2026-12-02T18:00:00.000Z"), tournament("a-live", "2026-11-01T18:00:00.000Z", "live")] },
      { game: game("b"), tournaments: [tournament("b-soon", "2026-11-20T18:00:00.000Z"), tournament("b-done", "2026-10-01T18:00:00.000Z", "finished")] },
    ])
    expect(list.map((entry) => entry.id)).toEqual(["b-soon", "a-late"])
    expect(list.map((entry) => entry.game.slug)).toEqual(["b", "a"])
  })

  it("are no more than the home lists", () => {
    const many = Array.from({ length: HOME_TOURNAMENTS + 3 }, (_, index) => tournament(`t${String(index).padStart(2, "0")}`, `2026-12-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`))
    expect(openTournaments([{ game: game("a"), tournaments: many }])).toHaveLength(HOME_TOURNAMENTS)
    expect(openTournaments([{ game: game("a"), tournaments: many }])[0]!.id).toBe("t00")
  })

  it("are none when no game has one: the home says so", () => {
    expect(openTournaments([])).toEqual([])
    expect(openTournaments([{ game: game("a"), tournaments: [] }])).toEqual([])
  })

  it("keep the order of the ids when two start together, so the list never shuffles", () => {
    const list = openTournaments([{ game: game("a"), tournaments: [tournament("z", "2026-12-01T18:00:00.000Z"), tournament("m", "2026-12-01T18:00:00.000Z")] }])
    expect(list.map((entry) => entry.id)).toEqual(["m", "z"])
  })
})

describe("what the demo account shows in the column", () => {
  const now = new Date("2026-11-16T10:30:00.000Z")

  it("has an article that leads to a page of the hub", () => {
    expect(DEMO_ARTICLE.title).not.toBe("")
    expect(DEMO_ARTICLE.summary.length).toBeLessThanOrEqual(280)
    expect(DEMO_ARTICLE.href.startsWith("/")).toBe(true)
  })

  it("has six tournaments, one after the other on the games it has in turn, in the days to come, on the hour", () => {
    const list = demoTournaments([game("a"), game("b"), game("c")], now)
    expect(list).toHaveLength(6)
    expect(list.map((entry) => entry.game.slug)).toEqual(["a", "b", "c", "a", "b", "c"])
    expect(new Set(list.map((entry) => entry.id)).size).toBe(6)
    for (const entry of list) {
      expect(Date.parse(entry.startsAt)).toBeGreaterThan(now.getTime())
      expect(entry.startsAt).toMatch(/T\d\d:00:00\.000Z$/)
      expect(entry.status).toBe("upcoming")
    }
  })

  it("has enough for the list to have pages to scroll, and one that is full and the others that are not, in the order the home lists them", () => {
    const list = demoTournaments([game("a"), game("b")], now)
    expect(list.length).toBeGreaterThan(TOURNAMENTS_PER_PAGE_MAX)
    expect(list.filter((entry) => entry.registered >= entry.places)).toHaveLength(1)
    expect(openTournaments(list.map((entry) => ({ game: entry.game, tournaments: [entry] }))).map((entry) => entry.id)).toEqual(list.map((entry) => entry.id))
  })

  it("has none when the member has no game", () => {
    expect(demoTournaments([], now)).toEqual([])
  })
})

describe("how many open tournaments a page holds", () => {
  it("is as many as fit the height with the space between the rows, four at the most", () => {
    expect(TOURNAMENTS_PER_PAGE_MAX).toBe(4)
    expect(perPageFor(104 * 4 + ROW_GAP * 3, 104)).toBe(4)
    expect(perPageFor(104 * 4 + ROW_GAP * 3 - 1, 104)).toBe(3)
    expect(perPageFor(104 * 3 + ROW_GAP * 2, 104)).toBe(3)
    expect(perPageFor(104 * 3 + ROW_GAP * 2 - 1, 104)).toBe(2)
    expect(perPageFor(104 * 2 + ROW_GAP, 104)).toBe(2)
    expect(perPageFor(104 * 2 + ROW_GAP - 1, 104)).toBe(1)
    expect(perPageFor(2000, 104)).toBe(TOURNAMENTS_PER_PAGE_MAX)
  })

  it("is never fewer than one, however little height there is", () => {
    expect(perPageFor(30, 104)).toBe(1)
    expect(perPageFor(104, 124)).toBe(1)
  })

  it("is the most while nothing is known: a column not laid out, a row not drawn", () => {
    expect(perPageFor(0, 104)).toBe(TOURNAMENTS_PER_PAGE_MAX)
    expect(perPageFor(-5, 104)).toBe(TOURNAMENTS_PER_PAGE_MAX)
    expect(perPageFor(400, 0)).toBe(TOURNAMENTS_PER_PAGE_MAX)
    expect(perPageFor(Number.NaN, 104)).toBe(TOURNAMENTS_PER_PAGE_MAX)
  })

  it("cuts the list into pages of that many, in order, the last page holding what is left", () => {
    expect(pagesOf([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]])
    expect(pagesOf([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
    expect(pagesOf([1, 2], 3)).toEqual([[1, 2]])
  })

  it("has no page for no item, and never a page of none whatever the size asked for", () => {
    expect(pagesOf([], 3)).toEqual([])
    expect(pagesOf([1, 2, 3], 0)).toEqual([[1], [2], [3]])
    expect(pagesOf([1, 2, 3], Number.NaN)).toEqual([[1], [2], [3]])
  })
})
