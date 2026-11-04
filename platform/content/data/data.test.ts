import { slugProblem } from "@pbgo/games/slug"
import { describe, expect, it } from "vitest"
import { CREATOR_ROLES } from "../../apps/studio/schemaTypes/constants.ts"
import { categoryId, creatorId, expansionId, gameId, publisherId } from "./ids.ts"
import { buildSeedContent } from "./index.ts"
import { notionExpansion, notionGame, publisherRow, seedDocs, source } from "./test-fixtures.ts"

/**
 * A reference as the Studio writes it into a draft whose target is not published: weak, marked to be made strong when the draft is
 * published. `weak`: the field is weak for good, and the mark says so.
 */
const link = (id: string, type: string, weak = false) => ({ _type: "reference", _ref: id, _weak: true, _strengthenOnPublish: weak ? { type, weak: true } : { type } })
const listed = (id: string, type: string, weak = false) => ({ _key: id, ...link(id, type, weak) })

/** A row of a translated field as the seed writes it: its key is its language. */
const row = (type: string, language: string, value: string) => ({ _key: language, _type: `internationalizedArray${type}Value`, language, value })
/** The empty row of English that the seed gives a translated field its source has nothing for. */
const emptyRow = (type: string) => ({ _key: "en", _type: `internationalizedArray${type}Value`, language: "en" })

const byId = (id: string) => {
  const found = seedDocs().find((doc) => doc._id === id)
  if (!found) throw new Error(`The seed has no document ${id}`)
  return found
}

describe("the ids", () => {
  it("are made of the type and of the name, accents and capitals gone", () => {
    expect(gameId("flip-7")).toBe("game-flip-7")
    expect(expansionId("hanabi-extra")).toBe("expansion-hanabi-extra")
    expect(creatorId("Émilie Ménard")).toBe("creator-emilie-menard")
    expect(publisherId("Nobody's Games")).toBe("publisher-nobodys-games")
    expect(categoryId("Push your luck")).toBe("category-push-your-luck")
  })

  it("are refused for a name with no letter or digit in it", () => {
    expect(() => creatorId("…")).toThrow('"…" has no letter or digit to make the id of a creator from')
  })
})

describe("the documents of the seed", () => {
  it("are the people, the publishers and the categories the games and expansions point at, then the games, then the expansions: a game is published before its expansions", () => {
    expect(seedDocs().map((doc) => doc._id)).toEqual([
      "creator-antoine-bauza",
      "creator-laura-michaud",
      "creator-wolfgang-warsch",
      "creator-eric-olsen",
      "creator-emilie-menard",
      "creator-ada-marsh",
      "publisher-cocktail-games",
      "publisher-pandasaurus",
      "publisher-fireworks-press",
      "category-cooperation",
      "category-deduction",
      "category-push-your-luck",
      "game-hanabi",
      "game-the-mind",
      "game-flip-7",
      "game-flip-7-vengeance",
      "game-bare",
      "expansion-hanabi-extra",
      "expansion-the-mind-extreme",
    ])
  })

  it("are of the five types the Studio's catalog seeds, and none of the editorial ones", () => {
    expect([...new Set(seedDocs().map((doc) => doc._type))]).toEqual(["creator", "publisher", "category", "game", "expansion"])
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
    expect(byId("publisher-fireworks-press")).toEqual({ _id: "publisher-fireworks-press", _type: "publisher", name: "Fireworks Press", website: "https://fireworks.example.com" })
    expect(seedDocs().some((doc) => doc._id === "publisher-nobodys-games")).toBe(false)
  })

  it("leave out the website of a publisher that has none", () => {
    const { docs } = buildSeedContent({ games: [notionGame("a", { publishers: [{ name: "No Site", url: null }] })], publishers: [] })
    expect(docs.find((doc) => doc._id === "publisher-no-site")).toEqual({ _id: "publisher-no-site", _type: "publisher", name: "No Site" })
  })

  it("give a category its name and the empty row of English of its names, and leave its icon, its color and its description to the Studio", () => {
    expect(byId("category-push-your-luck")).toEqual({ _id: "category-push-your-luck", _type: "category", name: "Push your luck", names: [emptyRow("LocalizedName")] })
  })

  it("refuse two names that make one id, which only the source can settle", () => {
    expect(() => buildSeedContent({ games: [notionGame("a", { authors: ["Émile"], illustrators: ["Emile"] })], publishers: [] })).toThrow(
      'The person "Émile" and "Emile" make the same id "creator-emile": rename one of them in Notion',
    )
  })

  it("are not made of games the source does not give: an empty catalog seeds nothing", () => {
    expect(buildSeedContent({ games: [], publishers: [] })).toEqual({ docs: [], slots: [] })
  })

  it("seed no expansion unless the source gives some: the Notion rows of the expansions are not read yet", () => {
    const { expansions: _given, ...withNone } = source()
    expect(buildSeedContent(withNone).docs.some((doc) => doc._type === "expansion")).toBe(false)
    expect(buildSeedContent({ ...withNone, expansions: [] }).docs).toEqual(buildSeedContent(withNone).docs)
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

  it("leaves out everything its row leaves empty, and writes no empty value: all it writes for it is the empty row of English that each translated field has", () => {
    const doc = byId("game-bare")
    expect(Object.keys(doc).sort()).toEqual(["_id", "_type", "boxFront", "cover", "description", "kind", "logo", "name", "names", "order", "rules", "slug", "tagline"])
    expect(doc).toMatchObject({ names: [emptyRow("LocalizedName")], tagline: [emptyRow("String")], description: [emptyRow("Description")], rules: [emptyRow("Url")], logo: [emptyRow("Image")], cover: [emptyRow("Image")], boxFront: [emptyRow("Image")] })
  })

  it("points at its categories and its publishers by reference, each in a list item that has a key", () => {
    const doc = byId("game-the-mind")
    expect(doc.categories).toEqual([listed("category-cooperation", "category")])
    expect(doc.publishers).toEqual([listed("publisher-cocktail-games", "publisher"), listed("publisher-pandasaurus", "publisher")])
  })

  it("credits a person once, on one line with every role they have on it: the designers are designers, the artists artists, and one can be both", () => {
    expect(byId("game-hanabi").creators).toEqual([
      { _key: "creator-antoine-bauza", _type: "gameCreator", creator: link("creator-antoine-bauza", "creator"), roles: ["designer", "artist"] },
      { _key: "creator-laura-michaud", _type: "gameCreator", creator: link("creator-laura-michaud", "creator"), roles: ["artist"] },
    ])
    expect(byId("game-the-mind").creators).toEqual([{ _key: "creator-wolfgang-warsch", _type: "gameCreator", creator: link("creator-wolfgang-warsch", "creator"), roles: ["designer"] }])
  })

  it("takes its description and its link to the rules in each language its row has them in: a row for each, English first, the key of a row being its language", () => {
    const doc = byId("game-hanabi")
    expect(doc.description).toEqual([
      row("Description", "en", "A cooperative card game in which nobody sees their own cards."),
      row("Description", "fr", "Un jeu de cartes coopératif."),
    ])
    expect(doc.rules).toEqual([row("Url", "en", "https://example.com/hanabi-en.pdf"), row("Url", "fr", "https://example.com/hanabi-fr.pdf")])
  })

  it("has no field of the old model: no link to the rules per language", () => {
    for (const key of ["rulesFr", "rulesEn", "rulesEs", "rulesDe"]) expect(key in byId("game-hanabi"), key).toBe(false)
  })

  it("writes no row for a language its row leaves empty, the empty row of English coming first where English has no text", () => {
    expect(byId("game-the-mind")).toMatchObject({ description: [emptyRow("Description")], rules: [emptyRow("Url")] })
    const { docs } = buildSeedContent({ games: [notionGame("a", { descriptions: { fr: "Un jeu.", de: "" }, rules: { es: "https://example.com/es.pdf" } })], publishers: [] })
    expect(docs.find((doc) => doc._id === "game-a")).toMatchObject({
      description: [emptyRow("Description"), row("Description", "fr", "Un jeu.")],
      rules: [emptyRow("Url"), row("Url", "es", "https://example.com/es.pdf")],
    })
  })

  it("writes no tagline, no cover and no box, only their empty row of English, and no status: Notion has none of them, and the status stays in the registry", () => {
    expect(byId("game-hanabi")).toMatchObject({ tagline: [emptyRow("String")], cover: [emptyRow("Image")], boxFront: [emptyRow("Image")] })
    expect("status" in byId("game-hanabi")).toBe(false)
  })

  it("is related to the games its row names, and to the games whose row names it: both ways, its own links first", () => {
    expect(byId("game-hanabi").related).toEqual([listed("game-the-mind", "game", true)])
    expect(byId("game-the-mind").related).toEqual([listed("game-hanabi", "game", true)])
    expect(byId("game-flip-7").related).toEqual([listed("game-flip-7-vengeance", "game", true)])
    expect(byId("game-flip-7-vengeance").related).toEqual([listed("game-flip-7", "game", true)])
    expect("related" in byId("game-bare")).toBe(false)
  })

  it("writes every reference as the Studio writes one to a document that is not published: weak, and marked to be made strong on publication, except `related`, which stays weak", () => {
    const marks = (value: unknown): { ref: string; weak: boolean | undefined; strengthen: unknown }[] =>
      (Array.isArray(value) ? value : [value]).flatMap((entry) =>
        entry && typeof entry === "object" && "_ref" in entry
          ? [{ ref: String((entry as { _ref: unknown })._ref), weak: (entry as { _weak?: boolean })._weak, strengthen: (entry as { _strengthenOnPublish?: unknown })._strengthenOnPublish }]
          : [],
      )
    for (const doc of seedDocs().filter((candidate) => candidate._type === "game")) {
      for (const [field, type] of [["categories", "category"], ["publishers", "publisher"], ["baseGame", "game"]] as const) {
        for (const mark of marks(doc[field])) expect(mark, `${doc._id} › ${field}`).toMatchObject({ weak: true, strengthen: { type } })
      }
      for (const line of doc.creators ?? []) expect(marks(line.creator)[0], `${doc._id} › creators`).toMatchObject({ weak: true, strengthen: { type: "creator" } })
      for (const mark of marks(doc.related)) expect(mark, `${doc._id} › related`).toMatchObject({ weak: true, strengthen: { type: "game", weak: true } })
    }
    // an expansion's base game is a strong reference in the schema: the mark does not say `weak`
    for (const doc of seedDocs().filter((candidate) => candidate._type === "expansion")) {
      for (const [field, type] of [["publishers", "publisher"], ["baseGame", "game"]] as const) {
        for (const mark of marks(doc[field])) expect(mark, `${doc._id} › ${field}`).toMatchObject({ weak: true, strengthen: { type } })
      }
      for (const line of doc.creators ?? []) expect(marks(line.creator)[0], `${doc._id} › creators`).toMatchObject({ weak: true, strengthen: { type: "creator" } })
      for (const mark of marks(doc.baseGame)) expect(mark.strengthen, `${doc._id} › baseGame`).not.toHaveProperty("weak")
    }
  })

  it("is a reference only to a document the dataset refuses nothing about: every reference is weak, so a draft can point at what is not published", () => {
    const strong = JSON.stringify(seedDocs()).match(/"_type":"reference","_ref":"[^"]+"(?!,"_weak":true)/g)
    expect(strong).toBeNull()
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

describe("an expansion", () => {
  it("has its name, its slug and its id made of its slug, and is an `expansion`, not a game", () => {
    expect(byId("expansion-hanabi-extra")).toMatchObject({ _type: "expansion", name: "Hanabi: Extra", slug: { _type: "slug", current: "hanabi-extra" } })
    expect(seedDocs().filter((doc) => doc._type === "game").map((doc) => doc._id)).not.toContain("game-hanabi-extra")
  })

  it("points at its base game by a reference written as the Studio writes one to a game that is not published: weak, and marked to be made strong, as a strong reference", () => {
    expect(byId("expansion-hanabi-extra").baseGame).toEqual(link("game-hanabi", "game"))
    expect(byId("expansion-the-mind-extreme").baseGame).toEqual(link("game-the-mind", "game"))
  })

  it("carries what its row says, as a game does: its figures, its BoardGameGeek id and the day it came out", () => {
    expect(byId("expansion-hanabi-extra")).toMatchObject({ bggId: 140934, playersMin: 2, playersMax: 6, duration: 30, minAge: 8, releaseDate: "2012-06-01" })
  })

  it("credits a person once, on one line with every role they have on it, and lists its publishers each in an item that has a key", () => {
    const doc = byId("expansion-hanabi-extra")
    expect(doc.creators).toEqual([
      { _key: "creator-antoine-bauza", _type: "gameCreator", creator: link("creator-antoine-bauza", "creator"), roles: ["designer"] },
      { _key: "creator-ada-marsh", _type: "gameCreator", creator: link("creator-ada-marsh", "creator"), roles: ["designer", "artist"] },
    ])
    expect(doc.publishers).toEqual([listed("publisher-cocktail-games", "publisher"), listed("publisher-fireworks-press", "publisher")])
  })

  it("brings its people and its publishers to the seed once, a person or a publisher a game has already making no second document", () => {
    const ids = seedDocs().map((doc) => doc._id)
    expect(ids.filter((id) => id === "creator-antoine-bauza")).toHaveLength(1)
    expect(ids.filter((id) => id === "publisher-cocktail-games")).toHaveLength(1)
    expect(byId("creator-ada-marsh")).toEqual({ _id: "creator-ada-marsh", _type: "creator", name: "Ada Marsh" })
  })

  it("takes its description and its link to the rules in each language its row has them in, as a game does", () => {
    const doc = byId("expansion-hanabi-extra")
    expect(doc.description).toEqual([row("Description", "en", "Rainbow fireworks join the deck."), row("Description", "fr", "Des feux d'artifice arc-en-ciel.")])
    expect(doc.rules).toEqual([row("Url", "en", "https://example.com/hanabi-extra-en.pdf")])
    for (const key of ["rulesFr", "rulesEn", "rulesEs", "rulesDe"]) expect(key in doc, key).toBe(false)
  })

  it("has nothing that places a game on the hub, and no picture but the empty row of English of its cover and its box: no kind, order, categories, complexity, related, tagline, logo, icon or background", () => {
    for (const key of ["kind", "order", "categories", "complexity", "related", "tagline", "logo", "icon", "background"]) expect(key in byId("expansion-hanabi-extra"), key).toBe(false)
    expect(byId("expansion-hanabi-extra")).toMatchObject({ cover: [emptyRow("Image")], boxFront: [emptyRow("Image")] })
  })

  it("leaves out everything its row leaves empty, and writes no empty value: all it writes for it is the empty row of English that each translated field has", () => {
    const doc = byId("expansion-the-mind-extreme")
    expect(Object.keys(doc).sort()).toEqual(["_id", "_type", "baseGame", "boxFront", "cover", "description", "name", "names", "rules", "slug"])
    expect(doc).toMatchObject({ names: [emptyRow("LocalizedName")], description: [emptyRow("Description")], rules: [emptyRow("Url")], cover: [emptyRow("Image")], boxFront: [emptyRow("Image")] })
  })

  it("leaves the base game out when it is not in the catalog: the Studio asks for it, an expansion cannot be published without one", () => {
    const { docs } = buildSeedContent({ games: [notionGame("a")], expansions: [notionExpansion("a-more", "ghost")], publishers: [] })
    const doc = docs.find((candidate) => candidate._id === "expansion-a-more")
    expect(doc).toMatchObject({ _type: "expansion", name: "a-more" })
    expect(doc).not.toHaveProperty("baseGame")
  })

  it("follows the order it is given", () => {
    const reversed = { ...source(), expansions: [...(source().expansions ?? [])].reverse() }
    const expansions = buildSeedContent(reversed).docs.filter((doc) => doc._type === "expansion")
    expect(expansions.map((doc) => doc._id)).toEqual(["expansion-the-mind-extreme", "expansion-hanabi-extra"])
  })

  it("stops the seed when two expansions have one slug: they would be one document", () => {
    const games = [notionGame("a")]
    const expansions = [notionExpansion("a-more", "a", { name: "A: More" }), notionExpansion("a-more", "a", { name: "A: Even more" })]
    expect(() => buildSeedContent({ games, expansions, publishers: [] })).toThrow('The expansions "A: More" and "A: Even more" have the same slug "a-more": settle it in Notion')
  })

  it("is an expansion of its slug whatever a game of the same slug is: the ids of a game and of an expansion do not meet", () => {
    const { docs } = buildSeedContent({ games: [notionGame("a"), notionGame("a-more")], expansions: [notionExpansion("a-more", "a")], publishers: [] })
    expect(docs.map((doc) => doc._id).filter((id) => id.endsWith("a-more"))).toEqual(["game-a-more", "expansion-a-more"])
  })
})

describe("what the seed writes", () => {
  const games = () => seedDocs().filter((doc) => doc._type === "game")
  const expansions = () => seedDocs().filter((doc) => doc._type === "expansion")
  const catalog = () => [...games(), ...expansions()]

  it("is a game whose slug the site can serve, each of them one that no other has", () => {
    for (const doc of games()) expect(slugProblem(doc.slug.current), doc._id).toBeUndefined()
    expect(new Set(games().map((doc) => doc.slug.current)).size).toBe(games().length)
  })

  it("is an expansion whose slug is one too, each of them one that no other expansion has", () => {
    for (const doc of expansions()) expect(slugProblem(doc.slug.current, [], "expansion"), doc._id).toBeUndefined()
    expect(new Set(expansions().map((doc) => doc.slug.current)).size).toBe(expansions().length)
  })

  it("never has a maximum of players under the minimum", () => {
    for (const doc of catalog()) if (doc.playersMax !== undefined) expect(doc.playersMax, doc._id).toBeGreaterThanOrEqual(doc.playersMin)
  })

  it("only gives a person the roles the Studio lists", () => {
    const roles = new Set<string>(CREATOR_ROLES.map((role) => role.value))
    for (const doc of catalog()) for (const line of doc.creators ?? []) for (const role of line.roles) expect(roles.has(role), `${doc._id} › ${role}`).toBe(true)
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
      "publisher-fireworks-press-logo",
    ])
  })

  it("have no slot for what Notion holds no picture of, nor for a publisher no game or expansion lists, nor for an expansion itself", () => {
    expect(slots.some((slot) => slot.name.includes("pandasaurus") || slot.name.includes("nobody"))).toBe(false)
    expect(slots.some((slot) => /cover|box|photo/.test(slot.name))).toBe(false)
    expect(slots.some((slot) => slot.name.startsWith("expansion-"))).toBe(false)
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
      const field = doc[slot.name.split("-").at(-1) ?? ""]
      // the logo of a game is translated (PLT-104): Notion's is the English one; the icon, the background and a publisher's logo are plain pictures
      if (slot.name.startsWith("game-") && slot.name.endsWith("-logo")) expect(field, slot.name).toEqual([{ _key: "en", _type: "internationalizedArrayImageValue", language: "en", value: image }])
      else expect(field, slot.name).toEqual(image)
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
