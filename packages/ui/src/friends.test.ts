import { describe, expect, it } from "vitest"
import { activityLine, gamesOf, initials, sectionsOf, tablesOf, type Friend } from "./friends"

const friend = (id: string, status: Friend["status"], rest: Partial<Friend> = {}): Friend => ({ id, nickname: id, status, ...rest })
const COURTISANS = { slug: "courtisans", name: "Courtisans" }
const HANABI = { slug: "hanabi", name: "Hanabi" }
const SKULL_KING = { slug: "skull-king", name: "Skull King" }

describe("sectionsOf", () => {
  it("lists the friends in a game, then online, then away, each section in its own order", () => {
    const sections = sectionsOf([friend("a", "offline"), friend("b", "online"), friend("c", "playing"), friend("d", "online"), friend("e", "playing")])
    expect(sections.map((section) => [section.label, section.friends.map((one) => one.id)])).toEqual([
      ["In a game", ["c", "e"]],
      ["Online", ["b", "d"]],
      ["Offline", ["a"]],
    ])
  })

  it("leaves out a section nobody is in", () => {
    expect(sectionsOf([friend("a", "offline")]).map((section) => section.status)).toEqual(["offline"])
    expect(sectionsOf([])).toEqual([])
  })
})

describe("gamesOf", () => {
  it("puts each friend under the game they are in, those who wait in the lobby apart from those who play", () => {
    const [courtisans] = gamesOf([
      friend("a", "playing", { game: COURTISANS }),
      friend("b", "online", { game: COURTISANS }),
      friend("c", "online", { game: COURTISANS }),
    ])
    expect(courtisans?.game).toEqual(COURTISANS)
    expect(courtisans?.playing.map((one) => one.id)).toEqual(["a"])
    expect(courtisans?.online.map((one) => one.id)).toEqual(["b", "c"])
    expect(courtisans?.count).toBe(3)
  })

  it("lists the most crowded game first, then by name", () => {
    const games = gamesOf([
      friend("a", "online", { game: SKULL_KING }),
      friend("b", "online", { game: HANABI }),
      friend("c", "playing", { game: COURTISANS }),
      friend("d", "online", { game: COURTISANS }),
    ])
    expect(games.map((entry) => [entry.game.slug, entry.count])).toEqual([
      ["courtisans", 2],
      ["hanabi", 1],
      ["skull-king", 1],
    ])
  })

  it("leaves out a friend who is away, and one who is in no game", () => {
    expect(gamesOf([friend("a", "offline", { game: COURTISANS }), friend("b", "online"), friend("c", "playing")])).toEqual([])
  })
})

describe("tablesOf", () => {
  const table = (code: string, size: number) => ({ code, size, max: 4 })

  it("brings the friends of one table together, tables in the order of their first friend, and the ones at no table last", () => {
    const groups = tablesOf([
      friend("a", "online"),
      friend("b", "online", { table: table("M3R", 2) }),
      friend("c", "online", { table: table("K7Q", 3) }),
      friend("d", "online", { table: table("M3R", 2) }),
    ])
    expect(groups.map((group) => [group.table?.code ?? null, group.friends.map((one) => one.id)])).toEqual([
      ["M3R", ["b", "d"]],
      ["K7Q", ["c"]],
      [null, ["a"]],
    ])
  })

  it("has no group for friends at no table when there are none", () => {
    expect(tablesOf([friend("a", "online", { table: table("M3R", 2) })])).toHaveLength(1)
    expect(tablesOf([])).toEqual([])
  })
})

describe("activityLine", () => {
  it("says the game, then what the friend is doing", () => {
    expect(activityLine(friend("a", "playing", { game: COURTISANS, activity: "Table K7P · 12 min" }))).toBe("Courtisans · Table K7P · 12 min")
    expect(activityLine(friend("b", "online", { game: HANABI }))).toBe("Hanabi")
    expect(activityLine(friend("c", "offline", { activity: "2 h ago" }))).toBe("2 h ago")
  })

  it("says nothing for a friend with neither", () => {
    expect(activityLine(friend("d", "online"))).toBeUndefined()
  })
})

describe("initials", () => {
  it("takes the first letter of up to two words, in capitals", () => {
    expect(initials("Marly")).toBe("M")
    expect(initials("jean luc picard")).toBe("JL")
    expect(initials("  hervé  ")).toBe("H")
  })

  it("keeps a character outside the basic plane whole, and has a mark for a name with nothing in it", () => {
    expect(initials("🎲 dice")).toBe("🎲D")
    expect(initials("   ")).toBe("?")
  })
})
