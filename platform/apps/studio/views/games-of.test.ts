import { evaluate, parse } from "groq-js"
import { describe, expect, it } from "vitest"
import { gamesOfQuery, rolesLine } from "./games-of"

// The queries of the "Games" tab run here against a small dataset by a GROQ engine: the Studio cannot be opened by a test, and a query that
// matches nothing would show an empty tab without a word.

const reference = (id: string) => ({ _type: "reference", _ref: id })
const credit = (key: string, creator: string, roles: string[]) => ({ _key: key, _type: "gameCreator", creator: reference(creator), roles })

const dataset = [
  { _id: "creator-bauza", _type: "creator", name: "Antoine Bauza" },
  { _id: "creator-kanai", _type: "creator", name: "Seiji Kanai" },
  { _id: "publisher-cocktail", _type: "publisher", name: "Cocktail Games" },
  {
    _id: "game-hanabi",
    _type: "game",
    name: "Hanabi",
    order: 20,
    creators: [credit("a", "creator-bauza", ["designer", "artist"])],
    publishers: [{ _key: "p", ...reference("publisher-cocktail") }],
  },
  { _id: "game-love-letter", _type: "game", name: "Love Letter", order: 10, creators: [credit("a", "creator-kanai", ["designer"])] },
  { _id: "game-ghost-stories", _type: "game", name: "Ghost Stories", order: 30, creators: [credit("a", "creator-kanai", ["developer"]), credit("b", "creator-bauza", ["writer"])] },
  { _id: "game-lonely", _type: "game", name: "Lonely" },
]

async function run(query: string, id: string) {
  const params = { id }
  return (await evaluate(parse(query, { params }), { dataset, params })).get()
}

describe("the games of a creator", () => {
  it("are the games that list them, lowest order first, with what the creator did on each", async () => {
    expect(await run(gamesOfQuery("creator"), "creator-bauza")).toEqual([
      { _id: "game-hanabi", name: "Hanabi", roles: ["designer", "artist"] },
      { _id: "game-ghost-stories", name: "Ghost Stories", roles: ["writer"] },
    ])
  })

  it("keep the roles of this creator only, on a game that credits several", async () => {
    expect(await run(gamesOfQuery("creator"), "creator-kanai")).toEqual([
      { _id: "game-love-letter", name: "Love Letter", roles: ["designer"] },
      { _id: "game-ghost-stories", name: "Ghost Stories", roles: ["developer"] },
    ])
  })

  it("are none for a creator no game lists", async () => {
    expect(await run(gamesOfQuery("creator"), "creator-nobody")).toEqual([])
  })
})

describe("the games of a publisher", () => {
  it("are the games that list them", async () => {
    expect(await run(gamesOfQuery("publisher"), "publisher-cocktail")).toEqual([{ _id: "game-hanabi", name: "Hanabi" }])
  })

  it("are none for a publisher no game lists", async () => {
    expect(await run(gamesOfQuery("publisher"), "publisher-nobody")).toEqual([])
  })
})

describe("rolesLine", () => {
  it("words the roles of a creator as the Studio does", () => {
    expect(rolesLine(["designer", "artist"])).toBe("Designer, Artist")
    expect(rolesLine(["insertDesigner"])).toBe("Insert designer")
  })

  it("is empty for no role", () => {
    expect(rolesLine([])).toBe("")
    expect(rolesLine(null)).toBe("")
    expect(rolesLine(undefined)).toBe("")
  })
})
