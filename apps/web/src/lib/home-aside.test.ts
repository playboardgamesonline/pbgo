import { describe, expect, it } from "vitest"
import { ARTICLE_LINES_DEFAULT, ARTICLE_LINES_MIN, ASIDE_FIT, DEMO_ARTICLE, demoTournaments, fitAside, HOME_TOURNAMENTS, openTournaments, pagesOf, perPageFor, ROW_GAP, summaryLinesFor, TOURNAMENTS_PER_PAGE_MAX, type AsideGame } from "./home-aside"

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
    // Long enough to fill the article of a tall window, still a teaser
    expect(DEMO_ARTICLE.summary.length).toBeGreaterThanOrEqual(400)
    expect(DEMO_ARTICLE.summary.length).toBeLessThanOrEqual(600)
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

describe("how many lines of the summary the article shows", () => {
  it("is its fewest while there is no room over them, and a line more for each line of room", () => {
    expect(ARTICLE_LINES_MIN).toBe(3)
    expect(summaryLinesFor(0, 20)).toBe(3)
    expect(summaryLinesFor(19, 20)).toBe(3)
    expect(summaryLinesFor(20, 20)).toBe(4)
    expect(summaryLinesFor(59, 20)).toBe(5)
    expect(summaryLinesFor(60, 20)).toBe(6)
  })

  it("is its fewest where nothing is known: no room, a line that is not measured", () => {
    expect(summaryLinesFor(-30, 20)).toBe(3)
    expect(summaryLinesFor(100, 0)).toBe(3)
    expect(summaryLinesFor(Number.NaN, 20)).toBe(3)
  })
})

describe("how the right column shares its height", () => {
  const column = { lineHeight: 20, rowHeight: 99, count: 6, empty: 0 }

  it("gives the tournaments their rows first, four at the most, and the article all that is left, in lines", () => {
    // 507px for the tournaments when the article has its three lines: four rows and their dots take 460, and the 47 left are two lines more
    expect(fitAside({ ...column, area: 487, shown: 4 })).toEqual({ perPage: 4, lines: 5 })
  })

  it("answers the same whatever the article is drawn with, since what it takes above its fewest lines is given back to the tournaments", () => {
    for (const [shown, area] of [[3, 507], [4, 487], [5, 467], [6, 447], [9, 387]] as const) expect(fitAside({ ...column, area, shown })).toEqual({ perPage: 4, lines: 5 })
  })

  it("counts fewer rows where the room is short, and gives the article what the rows leave", () => {
    // 300px: two rows and their dots take 238, and the 62 left are three lines
    expect(fitAside({ ...column, area: 300, shown: 3 })).toEqual({ perPage: 2, lines: 6 })
  })

  it("keeps the article's fewest lines, and one row, where there is no room at all", () => {
    expect(fitAside({ ...column, area: 100, shown: 3 })).toEqual({ perPage: 1, lines: 3 })
  })

  it("has no dots to make room for when every tournament fits one page", () => {
    // three tournaments, 500px: they are one page of 321px, with no dots, and the 179 left are eight lines
    expect(fitAside({ ...column, count: 3, area: 500, shown: 3 })).toEqual({ perPage: 4, lines: 11 })
  })

  it("gives the article the room that the empty state leaves when no tournament is open", () => {
    expect(fitAside({ ...column, count: 0, rowHeight: 0, empty: 120, area: 500, shown: 3 })).toEqual({ perPage: TOURNAMENTS_PER_PAGE_MAX, lines: 22 })
  })

  it("counts the tournaments alone where there is no article", () => {
    expect(fitAside({ ...column, area: 300, shown: 0, lineHeight: 0 })).toEqual({ perPage: 2, lines: ARTICLE_LINES_DEFAULT })
  })

  it("is the default where nothing is known: a column that is not laid out, rows that are not drawn", () => {
    expect(fitAside({ ...column, area: 0, shown: 3 })).toEqual(ASIDE_FIT)
    expect(fitAside({ ...column, area: Number.NaN, shown: 3 })).toEqual(ASIDE_FIT)
    expect(fitAside({ ...column, area: 400, shown: 3, rowHeight: 0 })).toEqual(ASIDE_FIT)
  })
})
