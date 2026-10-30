import { describe, expect, it } from "vitest"
import { comparePlanned, hubOrder } from "./order.ts"
import { DEVELOPMENT_OPTIONS, developmentRank } from "./testing.ts"
import type { NotionGame } from "./types.ts"

/** A game of Notion with nothing filled but its slug and name. */
const notionGame = (slug: string, overrides: Partial<NotionGame> = {}): NotionGame => ({
  slug,
  name: slug,
  descriptions: {},
  players: null,
  duration: null,
  complexity: null,
  bggId: null,
  releaseDate: null,
  age: null,
  categories: [],
  authors: [],
  illustrators: [],
  publishers: [],
  rules: {},
  art: { logo: false, icon: false, background: false },
  development: developmentRank(),
  standaloneOf: null,
  related: [],
  editedAt: "",
  notionPageId: `game-${slug}`,
  ...overrides,
})

describe("comparePlanned", () => {
  const order = (...games: ReturnType<typeof notionGame>[]) => [...games].sort(comparePlanned).map((game) => game.slug)

  it("sorts names the way a reader expects: numbers by value, case and accents ignored", () => {
    const names = ["Skyjo", "7 Wonders", "10 Minutes", "6 nimmt!", "Échecs", "the Mind", "Bang"]
    expect(order(...names.map((name) => notionGame(name, { name })))).toEqual(["6 nimmt!", "7 Wonders", "10 Minutes", "Bang", "Échecs", "Skyjo", "the Mind"])
  })

  it("keeps Notion's order between names that differ only by case or accents", () => {
    const spellings = [notionGame("c", { name: "Bâng" }), notionGame("a", { name: "Bang" }), notionGame("b", { name: "bang" })]
    expect(order(...spellings)).toEqual(["c", "a", "b"])
    expect(order(...[...spellings].reverse())).toEqual(["b", "a", "c"])
  })

  describe("with the rank of the Games Development database", () => {
    /** A game that stands where `chosen` says (options by name), called `name` (its slug unless told otherwise). */
    const ranked = (slug: string, chosen: Parameters<typeof developmentRank>[0], name = slug) => notionGame(slug, { name, development: developmentRank(chosen) })

    it("puts the nearest priority first, whatever the other columns say", () => {
      const games = [
        ranked("c", { priority: "P3 · Later", status: "Live", effort: "S" }),
        ranked("a", { priority: "P1 · Now", status: "Not started", effort: "XXL" }),
        ranked("d", { priority: "P4 · Someday", status: "Live", effort: "S" }),
        ranked("b", { priority: "P2 · Next", status: "Not started", effort: "XXL" }),
      ]
      expect(order(...games)).toEqual(["a", "b", "c", "d"])
    })

    it("puts the game that is furthest along first within a priority: the last status first, as the view sorts it", () => {
      const games = DEVELOPMENT_OPTIONS.status.map((status) => ranked(status, { priority: "P1 · Now", status }))
      expect(order(...games)).toEqual([...DEVELOPMENT_OPTIONS.status].reverse())
    })

    it("puts the lightest effort first within a priority and a status", () => {
      const games = DEVELOPMENT_OPTIONS.effort.map((effort) => ranked(effort, { priority: "P2 · Next", status: "Engine", effort }))
      expect(order(...[...games].reverse())).toEqual(["S", "M", "L", "XL", "XXL"])
    })

    it("looks at a column only where the ones before it tie", () => {
      const games = [
        ranked("far-light", { priority: "P2 · Next", status: "Playtest", effort: "S" }),
        ranked("near-heavy", { priority: "P1 · Now", status: "Rules", effort: "XXL" }),
        ranked("far-heavy", { priority: "P2 · Next", status: "Playtest", effort: "XL" }),
        ranked("near-far", { priority: "P1 · Now", status: "Table", effort: "XXL" }),
        ranked("early-light", { priority: "P2 · Next", status: "Engine", effort: "S" }),
      ]
      expect(order(...games)).toEqual(["near-far", "near-heavy", "far-light", "far-heavy", "early-light"])
    })

    it("puts a game with no value after every game that has one, in each column, whichever way the column goes", () => {
      const p1 = { priority: "P1 · Now" } as const
      // Priority goes up, Status goes down, Effort goes up: the empty cell is last in all three
      expect(order(ranked("none", {}), ranked("someday", { priority: "P4 · Someday" }))).toEqual(["someday", "none"])
      expect(order(ranked("none", p1), ranked("not-started", { ...p1, status: "Not started" }))).toEqual(["not-started", "none"])
      expect(order(ranked("none", { ...p1, status: "Live" }), ranked("xxl", { ...p1, status: "Live", effort: "XXL" }))).toEqual(["xxl", "none"])
    })

    it("counts an option the column no longer has as an empty cell", () => {
      const games = [ranked("retired", { priority: "P0 · Retired" }), ranked("someday", { priority: "P4 · Someday" })]
      expect(order(...games)).toEqual(["someday", "retired"])
    })

    it("falls back on the name where every column ties, and on the names alone where no game has a rank", () => {
      expect(order(ranked("z", { priority: "P1 · Now", status: "Engine", effort: "M" }, "Zeta"), ranked("a", { priority: "P1 · Now", status: "Engine", effort: "M" }, "Alpha"))).toEqual(["a", "z"])
      expect(order(...["Skyjo", "7 Wonders", "Bang"].map((name) => ranked(name, {}, name)))).toEqual(["7 Wonders", "Bang", "Skyjo"])
    })

    it("is the same order whichever way the games come, with ties, empty cells and all", () => {
      const games = [
        ranked("a", { priority: "P1 · Now", status: "Live", effort: "L" }, "A"),
        ranked("b", { priority: "P1 · Now", status: "Live", effort: "L" }, "B"),
        ranked("c", { priority: "P1 · Now", status: "Rules" }, "C"),
        ranked("d", { status: "Live", effort: "S" }, "D"),
        ranked("e", { priority: "P3 · Later", effort: "M" }, "E"),
        ranked("f", {}, "F"),
      ]
      const permutations = <T>(items: T[]): T[][] => (items.length <= 1 ? [items] : items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest])))
      const expected = ["a", "b", "c", "e", "d", "f"]
      expect(order(...games)).toEqual(expected)
      for (const permutation of permutations(games)) expect(order(...permutation)).toEqual(expected)
    })
  })
})

describe("hubOrder", () => {
  const rows = [
    notionGame("zeta", { name: "Zeta", development: developmentRank({ priority: "P1 · Now" }) }),
    notionGame("alpha", { name: "Alpha" }),
    notionGame("template"),
    notionGame("live-two", { name: "Live two" }),
    notionGame("live-one", { name: "Live one" }),
  ]

  it("lists the live games first, in the order of the registry, then the others as the hub sorts the games to come", () => {
    expect(hubOrder(["live-one", "live-two"], rows).map((row) => row.slug)).toEqual(["live-one", "live-two", "zeta", "alpha"])
  })

  it("never lists the template, live or not", () => {
    expect(hubOrder(["template"], rows).map((row) => row.slug)).not.toContain("template")
  })

  it("leaves out a live game that has no row", () => {
    expect(hubOrder(["live-one", "ghost"], rows).map((row) => row.slug)).toEqual(["live-one", "zeta", "alpha", "live-two"])
  })
})
