import { slugProblem } from "@pbgo/games/slug"
import { describe, expect, it } from "vitest"
import { CREATOR_ROLES } from "../../apps/studio/schemaTypes/constants.ts"
import { categoryId, creatorId, gameId, publisherId } from "./ids.ts"
import { buildSeedContent } from "./index.ts"
import { notionGame, publisherRow, seedDocs, source } from "./test-fixtures.ts"

const byId = (id: string) => {
  const found = seedDocs().find((doc) => doc._id === id)
  if (!found) throw new Error(`The seed has no document ${id}`)
  return found
}

describe("the ids", () => {
  it("are made of the type and of the name, accents and capitals gone", () => {
    expect(gameId("flip-7")).toBe("game-flip-7")
    expect(creatorId("Émilie Ménard")).toBe("creator-emilie-menard")
    expect(publisherId("Nobody's Games")).toBe("publisher-nobodys-games")
    expect(categoryId("Push your luck")).toBe("category-push-your-luck")
  })

  it("are refused for a name with no letter or digit in it", () => {
    expect(() => creatorId("…")).toThrow('"…" has no letter or digit to make the id of a creator from')
  })
})

describe("the documents of the seed", () => {
  it("are the people, the publishers and the categories the games point at, then the games", () => {
    expect(seedDocs().map((doc) => doc._id)).toEqual([
      "creator-antoine-bauza",
      "creator-laura-michaud",
      "creator-wolfgang-warsch",
      "creator-eric-olsen",
      "creator-emilie-menard",
      "publisher-cocktail-games",
      "publisher-pandasaurus",
      "category-cooperation",
      "category-deduction",
      "category-push-your-luck",
      "game-hanabi",
      "game-the-mind",
      "game-flip-7",
      "game-flip-7-vengeance",
      "game-bare",
    ])
  })

  it("are of the four types the Studio's catalog has, and none of the editorial ones", () => {
    expect([...new Set(seedDocs().map((doc) => doc._type))]).toEqual(["creator", "publisher", "category", "game"])
  })

  it("make one document of a name that several games carry", () => {
    const ids = seedDocs().map((doc) => doc._id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter((id) => id === "creator-antoine-bauza")).toHaveLength(1)
  })

  it("give a person nothing but their name", () => {
    expect(byId("creator-emilie-menard")).toEqual({ _id: "creator-emilie-menard", _type: "creator", name: "Émilie Ménard" })
  })

  it("give a publisher its website, the first one a game gives when the games do not agree, and leave out a publisher no game lists", () => {
    expect(byId("publisher-cocktail-games")).toEqual({ _id: "publisher-cocktail-games", _type: "publisher", name: "Cocktail Games", website: "https://www.cocktailgames.com" })
    expect(byId("publisher-pandasaurus")).toMatchObject({ website: "https://pandasaurus.example.com" })
    expect(seedDocs().some((doc) => doc._id === "publisher-nobodys-games")).toBe(false)
  })

  it("leave out the website of a publisher that has none", () => {
    const { docs } = buildSeedContent({ games: [notionGame("a", { publishers: [{ name: "No Site", url: null }] })], publishers: [] })
    expect(docs.find((doc) => doc._id === "publisher-no-site")).toEqual({ _id: "publisher-no-site", _type: "publisher", name: "No Site" })
  })

  it("give a category its name, and leave its icon, its color and its description to the Studio", () => {
    expect(byId("category-push-your-luck")).toEqual({ _id: "category-push-your-luck", _type: "category", name: "Push your luck" })
  })

  it("refuse two names that make one id, which only the source can settle", () => {
    expect(() => buildSeedContent({ games: [notionGame("a", { authors: ["Émile"], illustrators: ["Emile"] })], publishers: [] })).toThrow(
      'The person "Émile" and "Emile" make the same id "creator-emile": rename one of them in Notion',
    )
  })

  it("are not made of games the source does not give: an empty catalog seeds nothing", () => {
    expect(buildSeedContent({ games: [], publishers: [] })).toEqual({ docs: [], slots: [] })
  })
})

describe("a game", () => {
  it("has its name, its slug, its kind and the place the hub lists it at", () => {
    expect(byId("game-hanabi")).toMatchObject({ _type: "game", name: "Hanabi", slug: { _type: "slug", current: "hanabi" }, kind: "game", order: 10 })
  })

  it("is numbered 10, 20, 30… in the order the hub lists the games", () => {
    expect(seedDocs().filter((doc) => doc._type === "game").map((doc) => [doc.slug.current, doc.order])).toEqual([
      ["hanabi", 10],
      ["the-mind", 20],
      ["flip-7", 30],
      ["flip-7-vengeance", 40],
      ["bare", 50],
    ])
  })

  it("follows the order it is given", () => {
    const reversed = { ...source(), games: [...source().games].reverse() }
    const games = buildSeedContent(reversed).docs.filter((doc) => doc._type === "game")
    expect(games.map((doc) => doc._id)).toEqual(["game-bare", "game-flip-7-vengeance", "game-flip-7", "game-the-mind", "game-hanabi"])
    expect(games.map((doc) => doc.order)).toEqual([10, 20, 30, 40, 50])
  })

  it("carries what its row says: its figures, its BoardGameGeek id and the day it came out", () => {
    expect(byId("game-hanabi")).toMatchObject({ bggId: 98778, playersMin: 2, playersMax: 5, duration: 25, minAge: 8, complexity: 1.74, releaseDate: "2010-01-01" })
  })

  it("has no maximum when it is for N players or more", () => {
    const doc = byId("game-flip-7")
    expect(doc.playersMin).toBe(3)
    expect("playersMax" in doc).toBe(false)
  })

  it("leaves out everything its row leaves empty, and writes no empty value", () => {
    expect(Object.keys(byId("game-bare")).sort()).toEqual(["_id", "_type", "kind", "name", "order", "slug"])
  })

  it("points at its categories and its publishers by reference, each in a list item that has a key", () => {
    const doc = byId("game-the-mind")
    expect(doc.categories).toEqual([{ _key: "category-cooperation", _type: "reference", _ref: "category-cooperation" }])
    expect(doc.publishers).toEqual([
      { _key: "publisher-cocktail-games", _type: "reference", _ref: "publisher-cocktail-games" },
      { _key: "publisher-pandasaurus", _type: "reference", _ref: "publisher-pandasaurus" },
    ])
  })

  it("credits a person once, on one line with every role they have on it: the designers are designers, the artists artists, and one can be both", () => {
    expect(byId("game-hanabi").creators).toEqual([
      { _key: "creator-antoine-bauza", _type: "gameCreator", creator: { _type: "reference", _ref: "creator-antoine-bauza" }, roles: ["designer", "artist"] },
      { _key: "creator-laura-michaud", _type: "gameCreator", creator: { _type: "reference", _ref: "creator-laura-michaud" }, roles: ["artist"] },
    ])
    expect(byId("game-the-mind").creators).toEqual([
      { _key: "creator-wolfgang-warsch", _type: "gameCreator", creator: { _type: "reference", _ref: "creator-wolfgang-warsch" }, roles: ["designer"] },
    ])
  })

  it("takes the English description only, and a link to the rules in each language that has one", () => {
    const doc = byId("game-hanabi")
    expect(doc.description).toBe("A cooperative card game in which nobody sees their own cards.")
    expect(doc.rulesFr).toBe("https://example.com/hanabi-fr.pdf")
    expect(doc.rulesEn).toBe("https://example.com/hanabi-en.pdf")
    expect("rulesEs" in doc || "rulesDe" in doc).toBe(false)
    expect(Object.keys(doc).filter((key) => /^description./.test(key))).toEqual([])
  })

  it("writes no tagline, no cover, no box and no status: Notion has none of them, and the status stays in the registry", () => {
    for (const key of ["tagline", "cover", "boxFront", "status"]) expect(key in byId("game-hanabi")).toBe(false)
  })

  it("is related to the games its row names, and to the games whose row names it: both ways, its own links first", () => {
    expect(byId("game-hanabi").related).toEqual([{ _key: "game-the-mind", _type: "reference", _ref: "game-the-mind", _weak: true }])
    expect(byId("game-the-mind").related).toEqual([{ _key: "game-hanabi", _type: "reference", _ref: "game-hanabi", _weak: true }])
    expect(byId("game-flip-7").related).toEqual([{ _key: "game-flip-7-vengeance", _type: "reference", _ref: "game-flip-7-vengeance", _weak: true }])
    expect(byId("game-flip-7-vengeance").related).toEqual([{ _key: "game-flip-7", _type: "reference", _ref: "game-flip-7", _weak: true }])
    expect("related" in byId("game-bare")).toBe(false)
  })

  it("is related by weak references, and points at everything else by strong ones: games that name each other cannot wait for each other to be published", () => {
    const weak = (value: unknown) => (Array.isArray(value) ? value : [value]).flatMap((entry) => (entry && typeof entry === "object" && "_ref" in entry ? [Boolean((entry as { _weak?: boolean })._weak)] : []))
    for (const doc of seedDocs().filter((candidate) => candidate._type === "game")) {
      expect(weak(doc.related).every(Boolean), doc._id).toBe(true)
      for (const field of ["categories", "publishers", "baseGame"]) expect(weak(doc[field]).some(Boolean), `${doc._id} › ${field}`).toBe(false)
      for (const line of doc.creators ?? []) expect(weak(line.creator).some(Boolean), `${doc._id} › creators`).toBe(false)
    }
  })

  it("is not related to a game that is not in the catalog, nor to itself", () => {
    const { docs } = buildSeedContent({ games: [notionGame("a", { related: ["ghost", "a"] })], publishers: [] })
    expect(docs.find((doc) => doc._id === "game-a")).not.toHaveProperty("related")
  })

  it("keeps the own links before the reverse ones, whatever the order of the catalog", () => {
    const games = [notionGame("a", { related: ["c"] }), notionGame("b", { related: ["a"] }), notionGame("c")]
    const { docs } = buildSeedContent({ games, publishers: [] })
    const related = (id: string) => (docs.find((doc) => doc._id === id)?.related as { _ref: string }[]).map((link) => link._ref)
    expect(related("game-a")).toEqual(["game-c", "game-b"])
  })

  it("makes a standalone expansion a reimplementation of its base game, and nothing else has a base game", () => {
    expect(byId("game-flip-7-vengeance")).toMatchObject({ kind: "reimplementation", baseGame: { _type: "reference", _ref: "game-flip-7" } })
    for (const id of ["game-hanabi", "game-the-mind", "game-flip-7", "game-bare"]) {
      expect(byId(id)).toMatchObject({ kind: "game" })
      expect("baseGame" in byId(id)).toBe(false)
    }
  })

  it("leaves the base game out when it is not in the catalog", () => {
    const { docs } = buildSeedContent({ games: [notionGame("vengeance", { standaloneOf: "ghost" })], publishers: [] })
    const doc = docs.find((candidate) => candidate._id === "game-vengeance")
    expect(doc).toMatchObject({ kind: "reimplementation" })
    expect(doc).not.toHaveProperty("baseGame")
  })
})

describe("what the seed writes", () => {
  const games = () => seedDocs().filter((doc) => doc._type === "game")

  it("is a game whose slug the site can serve, each of them one that no other has", () => {
    for (const doc of games()) expect(slugProblem(doc.slug.current), doc._id).toBeUndefined()
    expect(new Set(games().map((doc) => doc.slug.current)).size).toBe(games().length)
  })

  it("never has a maximum of players under the minimum", () => {
    for (const doc of games()) if (doc.playersMax !== undefined) expect(doc.playersMax, doc._id).toBeGreaterThanOrEqual(doc.playersMin)
  })

  it("only gives a person the roles the Studio lists", () => {
    const roles = new Set<string>(CREATOR_ROLES.map((role) => role.value))
    for (const doc of games()) for (const line of doc.creators ?? []) for (const role of line.roles) expect(roles.has(role), `${doc._id} › ${role}`).toBe(true)
  })

  it("keeps the key of each item of a list apart from the others'", () => {
    for (const doc of seedDocs()) {
      for (const value of Object.values(doc)) {
        if (!Array.isArray(value)) continue
        const keys = value.flatMap((entry) => (entry && typeof entry === "object" && "_key" in entry ? [String((entry as { _key: unknown })._key)] : []))
        expect(new Set(keys).size, doc._id).toBe(keys.length)
      }
    }
  })
})

describe("the art slots", () => {
  const { slots } = buildSeedContent(source())

  it("are the pictures the rows hold: a game's logo, icon and background, and the logo of a publisher the games list", () => {
    expect(slots.map((slot) => slot.name)).toEqual([
      "game-hanabi-logo",
      "game-hanabi-background",
      "game-the-mind-logo",
      "game-the-mind-icon",
      "publisher-cocktail-games-logo",
    ])
  })

  it("have no slot for what Notion holds no picture of, nor for a publisher no game lists", () => {
    expect(slots.some((slot) => slot.name.includes("pandasaurus") || slot.name.includes("nobody"))).toBe(false)
    expect(slots.some((slot) => /cover|box|photo/.test(slot.name))).toBe(false)
  })

  it("point at a document of the seed, and are named apart", () => {
    const ids = new Set(seedDocs().map((doc) => doc._id))
    for (const slot of slots) expect(ids.has(slot.docId), slot.name).toBe(true)
    expect(new Set(slots.map((slot) => slot.name)).size).toBe(slots.length)
  })

  it("put the picture in the field that bears the name of what it is", () => {
    const docs = buildSeedContent(source()).docs
    const image = { _type: "image" as const, asset: { _type: "reference" as const, _ref: "image-abc-10x10-webp" } }
    for (const slot of slots) {
      const doc = docs.find((candidate) => candidate._id === slot.docId)
      if (!doc) throw new Error(`No document for ${slot.name}`)
      slot.place(doc, image)
      expect(doc[slot.name.split("-").at(-1) ?? ""], slot.name).toEqual(image)
    }
  })

  it("keep a picture within a size a card needs", () => {
    for (const slot of slots) expect(slot.maxSize, slot.name).toBeGreaterThanOrEqual(1024)
  })

  it("are none for a publisher whose Editors row has no logo link", () => {
    const { slots: none } = buildSeedContent({ games: source().games, publishers: [publisherRow("Cocktail Games")] })
    expect(none.some((slot) => slot.name.startsWith("publisher-"))).toBe(false)
  })
})
