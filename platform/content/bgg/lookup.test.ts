import { describe, expect, it, vi } from "vitest"
import type { BggClient, BggDetail } from "./client.ts"
import { LOOKUP_CANDIDATES, LOOKUP_READ, LOOKUP_SHOWN, LOOKUP_VERSIONS, UsageError, comparable, lookupByName, lookupItem, parseLookupArgs } from "./lookup.ts"
import { thing, things } from "./test-fixtures.ts"
import type { BggCandidate, BggLink, BggVersion } from "./xml.ts"

// The lookup against a fake client: what it asks BGG for, in which order, and what it makes of the answers. The reader of the XML and the client have their own tests.

const found = (...ids: number[]): BggCandidate[] => ids.map((id) => ({ id, name: `Game ${id}`, year: 2000 }))

/** A client whose `search` answers one list for the exact name and another for the loose one, and whose `things` answers from a list. */
function searching(exact: BggCandidate[], loose: BggCandidate[], known: ReturnType<typeof thing>[]) {
  const search = vi.fn(async (_name: string, options?: { exact?: boolean; types?: readonly string[] }) => (options?.exact ? exact : loose))
  const read = vi.fn(async (ids: readonly number[]) => things(...known.filter((one) => ids.includes(one.id))))
  const client: Pick<BggClient, "search" | "things"> = { search, things: read }
  return { client, search, read }
}

describe("comparable", () => {
  it("does not count capitals, accents or punctuation", () => {
    expect(comparable("6 nimmt!")).toBe(comparable("6 Nimmt"))
    expect(comparable("Échecs & Dames")).toBe("echecs dames")
    expect(comparable("  Flip   7 ")).toBe("flip 7")
  })

  it("compares a name with nothing in it to compare as it is", () => {
    expect(comparable("ゲーム")).toBe("ゲーム")
    expect(comparable("ゲーム")).not.toBe(comparable("カード"))
  })
})

describe("lookupByName", () => {
  it("searches games and expansions twice, for the exact name and for the loose one, and reads the figures once for all of them", async () => {
    const { client, search, read } = searching(found(1), found(1, 2), [thing(1, { name: "Skyjo", names: ["Skyjo"] }), thing(2, { name: "Skyjo Action", names: ["Skyjo Action"] })])
    const answer = await lookupByName(client, "Skyjo")
    expect(search.mock.calls).toEqual([
      ["Skyjo", { exact: true, types: ["boardgame", "boardgameexpansion"] }],
      ["Skyjo", { types: ["boardgame", "boardgameexpansion"] }],
    ])
    expect(read).toHaveBeenCalledTimes(1)
    expect(read.mock.calls[0]?.[0]).toEqual([1, 2])
    expect(answer.query).toBe("Skyjo")
    expect(answer.matched).toBe(2)
  })

  it("puts the exact matches first, then the best known, and says which names matched", async () => {
    const { client } = searching(
      found(3),
      found(1, 2, 3),
      [
        thing(1, { name: "Take 5 Junior", names: ["Take 5 Junior"], ratings: 900 }),
        thing(2, { name: "Take 5 Duel", names: ["Take 5 Duel"], ratings: 4000 }),
        thing(3, { name: "Take 5", names: ["Take 5", "6 nimmt!", "6 qui prend!"], ratings: 33350 }),
      ],
    )
    const answer = await lookupByName(client, "6 Nimmt")
    expect(answer.candidates.map((candidate) => [candidate.id, candidate.exact])).toEqual([
      [3, true],
      [2, false],
      [1, false],
    ])
    expect(answer.candidates[0]?.alsoKnownAs).toEqual(["6 nimmt!", "6 qui prend!"])
  })

  it("gives the figures of a candidate as BGG has them, the weight rounded to two decimals", async () => {
    const { client } = searching(found(1), [], [thing(1, { name: "Azul", names: ["Azul"], year: 2017, type: "boardgame", rank: 99, rating: 7.7, ratings: 1000, weight: 1.7692, weights: 500 })])
    const [candidate] = (await lookupByName(client, "Azul")).candidates
    expect(candidate).toEqual({ id: 1, name: "Azul", alsoKnownAs: [], type: "boardgame", year: 2017, exact: true, rank: 99, rating: 7.7, ratings: 1000, weight: 1.77, weights: 500 })
  })

  it("keeps a candidate with no weight and no rank as it is", async () => {
    const { client } = searching([], found(4), [thing(4, { weight: null, weights: 0, rank: null, rating: null, ratings: 0 })])
    const [candidate] = (await lookupByName(client, "Nobody")).candidates
    expect(candidate).toMatchObject({ id: 4, weight: null, rank: null, rating: null, ratings: 0, exact: false })
  })

  it("leaves out an item that BGG did not answer for, but counts it as matched", async () => {
    const { client } = searching([], found(1, 2), [thing(2)])
    const answer = await lookupByName(client, "Game")
    expect(answer.candidates.map((candidate) => candidate.id)).toEqual([2])
    expect(answer.matched).toBe(2)
  })

  it(`reads the figures of ${LOOKUP_READ} matches at most and shows ${LOOKUP_CANDIDATES} of them, or as many as it is asked for`, async () => {
    const ids = Array.from({ length: 30 }, (_, index) => index + 1)
    const { client, read } = searching([], found(...ids), ids.map((id) => thing(id, { ratings: id })))
    const shown = await lookupByName(client, "Game")
    expect(read.mock.calls[0]?.[0]).toHaveLength(LOOKUP_READ)
    expect(shown.matched).toBe(30)
    expect(shown.candidates).toHaveLength(LOOKUP_CANDIDATES)
    expect((await lookupByName(client, "Game", { limit: 3 })).candidates).toHaveLength(3)
  })

  it("asks for nothing to read when nothing matched", async () => {
    const { client } = searching([], [], [])
    expect(await lookupByName(client, "Zzzz")).toEqual({ query: "Zzzz", matched: 0, candidates: [] })
  })
})

const link = (type: string, id: number, name: string, inbound = false): BggLink => ({ type, id, name, inbound })
const version = (id: number, year: number | null, languages: string[], publishers = ["Pub"]): BggVersion => ({ id, name: `Version ${id}`, year, publishers, languages, productCode: null })

/** A client whose `detail` answers this item. */
const detailing = (answer: BggDetail | null) => {
  const detail = vi.fn(async (_id: number, _options?: { versions?: boolean }) => answer)
  const client: Pick<BggClient, "detail"> = { detail }
  return { client, detail }
}

describe("lookupItem", () => {
  const sample: BggDetail = {
    thing: thing(7, { name: "Sample Reborn", names: ["Sample Reborn", "Sample 2", "Echantillon"], type: "boardgame", year: 2022, minPlayers: 2, maxPlayers: 6, playingTime: 30, minAge: 8, weight: 1.8567, weights: 940, rank: 812, rating: 7.4, ratings: 18200 }),
    links: [
      link("boardgamecategory", 1002, "Card Game"),
      link("boardgamepublisher", 9, "Sample Games"),
      link("boardgamepublisher", 9, "Sample Games"),
      link("boardgamepublisher", 10, "Other Games"),
      link("boardgamedesigner", 7, "Ada Lovelace"),
      link("boardgameartist", 8, "Grace Hopper"),
      link("boardgameimplementation", 50, "Sample", true),
      link("boardgameexpansion", 51, "Sample: The Expansion", true),
      link("boardgameexpansion", 52, "Sample Reborn: More"),
      link("boardgameexpansion", 53, "Sample Reborn: Even More"),
      link("boardgameimplementation", 60, "Sample Reborn Deluxe"),
    ],
    versions: [],
  }

  it("gives its figures as BGG has them, its credits once each, and how many expansions it has", async () => {
    const { client, detail } = detailing(sample)
    const item = await lookupItem(client, 7)
    expect(detail).toHaveBeenCalledWith(7, { versions: false })
    expect(item).toMatchObject({
      id: 7,
      type: "boardgame",
      name: "Sample Reborn",
      alsoKnownAs: ["Sample 2", "Echantillon"],
      year: 2022,
      minPlayers: 2,
      maxPlayers: 6,
      playingTime: 30,
      minAge: 8,
      rank: 812,
      rating: 7.4,
      ratings: 18200,
      weight: 1.86,
      weights: 940,
      publishers: ["Sample Games", "Other Games"],
      designers: ["Ada Lovelace"],
      artists: ["Grace Hopper"],
      expansions: 2,
    })
    expect(item.versions).toBeUndefined()
  })

  it("names what the item comes from first, then what came from it", async () => {
    const item = await lookupItem(detailing(sample).client, 7)
    expect(item.relations).toEqual([
      { type: "boardgameimplementation", inbound: true, id: 50, name: "Sample" },
      { type: "boardgameexpansion", inbound: true, id: 51, name: "Sample: The Expansion" },
      { type: "boardgameimplementation", inbound: false, id: 60, name: "Sample Reborn Deluxe" },
    ])
  })

  it(`shows ${LOOKUP_SHOWN} reimplementations that came from it at most`, async () => {
    const many = { ...sample, links: Array.from({ length: 10 }, (_, index) => link("boardgameimplementation", 100 + index, `Remake ${index}`)) }
    const item = await lookupItem(detailing(many).client, 7)
    expect(item.relations).toHaveLength(LOOKUP_SHOWN)
  })

  it("throws when BGG has no such item", async () => {
    await expect(lookupItem(detailing(null).client, 5)).rejects.toThrow("BoardGameGeek has no item 5")
  })

  it("gives the versions newest first, with how many there are, when it is asked to", async () => {
    const { client, detail } = detailing({ ...sample, versions: [version(1, 2019, ["English"]), version(2, null, ["German"]), version(3, 2024, ["English", "French"]), version(4, 2024, ["Dutch"])] })
    const item = await lookupItem(client, 7, { versions: true })
    expect(detail).toHaveBeenCalledWith(7, { versions: true })
    expect(item.versions?.total).toBe(4)
    expect(item.versions?.shown.map((one) => one.id)).toEqual([4, 3, 1, 2])
  })

  it("keeps the versions printed in a language, whatever the capitals", async () => {
    const { client } = detailing({ ...sample, versions: [version(1, 2019, ["English"]), version(2, 2020, ["German"]), version(3, 2024, ["English", "French"])] })
    const item = await lookupItem(client, 7, { versions: true, language: "english" })
    expect(item.versions).toMatchObject({ total: 2 })
    expect(item.versions?.shown.map((one) => one.id)).toEqual([3, 1])
  })

  it(`shows ${LOOKUP_VERSIONS} versions at most and counts them all`, async () => {
    const all = Array.from({ length: LOOKUP_VERSIONS + 15 }, (_, index) => version(index + 1, 2000 + (index % 20), ["English"]))
    const item = await lookupItem(detailing({ ...sample, versions: all }).client, 7, { versions: true })
    expect(item.versions?.total).toBe(LOOKUP_VERSIONS + 15)
    expect(item.versions?.shown).toHaveLength(LOOKUP_VERSIONS)
  })

  it("is made of JSON and nothing else, so that the scout can read it back", async () => {
    const item = await lookupItem(detailing({ ...sample, versions: [version(1, 2019, ["English"])] }).client, 7, { versions: true })
    expect(JSON.parse(JSON.stringify(item))).toEqual(item)
  })
})

describe("parseLookupArgs", () => {
  it("takes a name, in one word or in several", () => {
    expect(parseLookupArgs(["Skyjo"])).toMatchObject({ name: "Skyjo", id: null, versions: false, limit: LOOKUP_CANDIDATES })
    expect(parseLookupArgs(["Flip", "7", "Vengeance"]).name).toBe("Flip 7 Vengeance")
  })

  it("ignores the leading -- that pnpm may pass", () => {
    expect(parseLookupArgs(["--", "Skyjo"]).name).toBe("Skyjo")
  })

  it("takes --id, with its versions and a language, in the two ways of writing a value", () => {
    expect(parseLookupArgs(["--id", "8888"])).toMatchObject({ id: 8888, name: "", versions: false, language: null })
    expect(parseLookupArgs(["--id=8888", "--versions", "--language", "English"])).toMatchObject({ id: 8888, versions: true, language: "English" })
    expect(parseLookupArgs(["--id", "7", "--versions", "--language=Old English"]).language).toBe("Old English")
  })

  it("takes --limit for a search", () => {
    expect(parseLookupArgs(["Trio", "--limit", "3"]).limit).toBe(3)
    expect(parseLookupArgs(["--limit=20", "Trio"]).limit).toBe(20)
  })

  it("answers for --help or -h, with or without a name, and asks for nothing else", () => {
    expect(parseLookupArgs(["--help"]).help).toBe(true)
    expect(parseLookupArgs(["-h"]).help).toBe(true)
    expect(parseLookupArgs(["Skyjo", "--help"]).help).toBe(true)
  })

  it.each([
    [[], "Give the name"],
    [["Skyjo", "--id", "5"], "exclude each other"],
    [["--id", "abc"], "--id is the number"],
    [["--id", "0"], "--id is the number"],
    [["--id"], "--id needs a value"],
    [["--id", "--versions"], "--id needs a value"],
    [["Skyjo", "--versions"], "for one item"],
    [["--id", "5", "--language", "English"], "give --versions too"],
    [["Skyjo", "--limit", "0"], "--limit is a number"],
    [["Skyjo", "--limit", "21"], "--limit is a number"],
    [["Skyjo", "--limit", "two"], "--limit is a number"],
    [["--id", "5", "--limit", "2"], "search by name"],
    [["Skyjo", "--bogus"], "Unknown option --bogus"],
    [["Skyjo", "--versions=yes"], "Unknown option --versions=yes"],
  ])("refuses %j: %s", (argv, message) => {
    expect(() => parseLookupArgs(argv)).toThrow(UsageError)
    expect(() => parseLookupArgs(argv)).toThrow(message)
  })
})
