import { CARDS } from "@flip-7/engine"
import type { LoaderContext } from "@pbgo/core/lib/binding"
import type { Locale } from "@pbgo/core/lib/i18n"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const sanity = vi.hoisted(() => ({ catalog: null as unknown, down: false }))
vi.mock("./catalog", () => ({
  getCatalog: async () => {
    if (sanity.down) throw new Error("Sanity is down")
    return sanity.catalog
  },
}))

import { ACTION_KEYS, MISSING_CATALOG } from "../lib/catalog"
import { WORD_FIELDS } from "../lib/words"
import { getClientCatalog } from "./catalog-client"

// What a player sees of Flip 7 on the table comes from the game's Sanity project: the pictures of the cards and of their back, the name of each action card, the words of the board. A picture it does not
// have is null, a text it does not have in the language asked reads in English, and one that English does not have either reads [missing: <key>]: never another language.

const words = (values: Record<string, string>) => ({ _type: "localeString", ...values })
const picture = (seed: string) => ({ _type: "image", asset: { _type: "reference", _ref: `image-${seed.padEnd(40, "0")}-326x512-svg` } })

const NUMBER_FIGURES = Array.from({ length: 13 }, (_, figure) => String(figure))
const ACTION_NAMES: Record<string, Record<string, string>> = {
  freeze: { fr: "Gel", en: "Freeze" },
  "flip-three": { fr: "Flip Three", en: "Flip Three" },
  "second-chance": { fr: "Seconde chance", en: "Second Chance" },
}
const MODIFIER_KEYS = ["plus-2", "plus-4", "plus-6", "plus-8", "plus-10", "times-2"]

/** A project that holds the 22 cards with a picture each, the back, and every word of the board in French and English. */
function project() {
  return {
    game: { cardBack: picture("ba") },
    texts: Object.fromEntries(WORD_FIELDS.map((field) => [field, words({ fr: `${field} (fr)`, en: `${field} (en)` })])),
    numbers: NUMBER_FIGURES.map((key) => ({ key, image: picture(`a${key}`) })),
    actions: ACTION_KEYS.map((key) => ({ key, name: words(ACTION_NAMES[key]!), image: picture(key.replace(/\W/g, "")) })),
    modifiers: MODIFIER_KEYS.map((key) => ({ key, image: picture(key.replace(/\W/g, "")) })),
  }
}

const load = (locale: Locale, context: Partial<LoaderContext> = {}) =>
  getClientCatalog({ game: { slug: "flip-7", sanityProjectId: "ky3exlhe" }, locale, sanity: {}, ...context } as unknown as LoaderContext)

const errors = vi.spyOn(console, "error").mockImplementation(() => {})

beforeEach(() => {
  sanity.catalog = project()
  sanity.down = false
  errors.mockClear()
})

afterEach(() => errors.mockClear())

describe("the faces of the cards", () => {
  it("are one picture for each card of the engine's catalogue, by its key there", async () => {
    const { faces } = await load("en")
    expect(Object.keys(faces).sort()).toEqual(Object.keys(CARDS).sort())
    for (const [key, url] of Object.entries(faces)) expect(url, key).toMatch(/^https:\/\/cdn\.sanity\.io\/images\/ky3exlhe\/production\/[0-9a-z]+-326x512\.svg$/)
  })

  it("name a number by its figure, as the engine does, and the others by their key", async () => {
    const { faces } = await load("en")
    expect(faces["number-7"]).toContain("a70000")
    expect(faces["number-12"]).toContain("a120000")
    expect(faces["plus-10"]).toContain("plus100000")
    expect(faces["times-2"]).toContain("times20000")
    expect(faces["second-chance"]).toContain("secondchance")
  })

  it("are served as the file is: an SVG cannot be converted or resized by the image CDN", async () => {
    const { faces, backUrl } = await load("en")
    for (const url of [...Object.values(faces), backUrl]) expect(url).not.toContain("?")
  })

  it("are null for a card whose document has no picture yet or is not there at all, and no card is lost", async () => {
    const holding = project()
    holding.numbers = holding.numbers.map((card) => (card.key === "3" ? { key: "3", image: null as never } : card))
    holding.modifiers = holding.modifiers.filter((card) => card.key !== "plus-2")
    sanity.catalog = holding
    const { faces } = await load("en")
    expect(faces["number-3"]).toBeNull()
    expect(faces["plus-2"]).toBeNull()
    expect(faces["number-4"]).not.toBeNull()
    expect(Object.keys(faces)).toHaveLength(Object.keys(CARDS).length)
  })

  it("ignore a document whose key the engine does not know", async () => {
    const holding = project()
    holding.numbers = [...holding.numbers, { key: "13", image: picture("zz") }]
    sanity.catalog = holding
    const { faces } = await load("en")
    expect(Object.keys(faces)).not.toContain("number-13")
  })
})

describe("the back of the cards", () => {
  it("is the picture of the game document, null while it has none", async () => {
    expect((await load("en")).backUrl).toMatch(/cdn\.sanity\.io\/images\/ky3exlhe\/production\/ba0+-326x512\.svg$/)
    sanity.catalog = { ...project(), game: null }
    expect((await load("en")).backUrl).toBeNull()
    sanity.catalog = { ...project(), game: { cardBack: null } }
    expect((await load("en")).backUrl).toBeNull()
  })
})

describe("the names of the action cards", () => {
  it("are read in the language asked, else English", async () => {
    expect((await load("fr")).names.freeze).toBe("Gel")
    expect((await load("fr")).names["second-chance"]).toBe("Seconde chance")
    expect((await load("es")).names.freeze).toBe("Freeze")
    expect((await load("de")).names["second-chance"]).toBe("Second Chance")
  })

  it("read [missing: cards.<key>] when neither the language asked nor English has one, even if French has", async () => {
    const holding = project()
    holding.actions = holding.actions.map((card) => (card.key === "freeze" ? { ...card, name: words({ fr: "Gel" }) } : card))
    sanity.catalog = holding
    expect((await load("en")).names.freeze).toBe("[missing: cards.freeze]")
    expect((await load("es")).names.freeze).toBe("[missing: cards.freeze]")
    expect((await load("fr")).names.freeze).toBe("Gel")
  })
})

describe("the words of the board", () => {
  it("are read in the language asked, else English", async () => {
    const fr = await load("fr")
    const es = await load("es")
    expect(fr.words.hit).toBe("hit (fr)")
    expect(es.words.hit).toBe("hit (en)")
    expect(Object.keys(fr.words).sort()).toEqual([...WORD_FIELDS].sort())
  })

  it("read [missing: <key>] when English has none either, for the language that has none of its own: never French", async () => {
    sanity.catalog = { ...project(), texts: { stay: words({ fr: "Stop" }), hit: words({ en: "Hit" }) } }
    const es = await load("es")
    expect(es.words.stay).toBe("[missing: stay]")
    expect(es.words.hit).toBe("Hit")
    expect(es.words.deal).toBe("[missing: deal]")
    expect((await load("fr")).words.stay).toBe("Stop")
  })

  it("read [missing: <key>] for all of them while the `texts` document is not in Sanity", async () => {
    sanity.catalog = { ...project(), texts: null }
    const { words: vocabulary } = await load("en")
    for (const field of WORD_FIELDS) expect(vocabulary[field]).toBe(`[missing: ${field}]`)
  })

  it("are reported once in the server log, with the key of the text", async () => {
    sanity.catalog = { ...project(), texts: null }
    // a fresh copy of the loader: it remembers what it has reported
    vi.resetModules()
    const { getClientCatalog: fresh } = await import("./catalog-client")
    const ask = () => fresh({ game: { slug: "flip-7", sanityProjectId: "ky3exlhe" }, locale: "en", sanity: {} } as unknown as LoaderContext)
    await ask()
    await ask()
    const lines = errors.mock.calls.map((call) => String(call[0]))
    expect(lines.filter((line) => line.includes("eventOver"))).toHaveLength(1)
    expect(lines.find((line) => line.includes("eventOver"))).toBe("[missing] flip-7 (en): eventOver is not in Sanity")
  })
})

describe("when Sanity is not there", () => {
  it("is the catalog of markers and no picture for a game with no Sanity client", async () => {
    expect(await load("en", { sanity: null })).toEqual(MISSING_CATALOG)
    expect(MISSING_CATALOG.backUrl).toBeNull()
    expect(Object.values(MISSING_CATALOG.faces).every((url) => url === null)).toBe(true)
    expect(MISSING_CATALOG.words.hit).toBe("[missing: hit]")
    expect(MISSING_CATALOG.names.freeze).toBe("[missing: cards.freeze]")
  })

  it("is the same catalog when Sanity does not answer, and the error is logged", async () => {
    sanity.down = true
    expect(await load("en")).toEqual(MISSING_CATALOG)
    expect(errors).toHaveBeenCalledWith("Sanity catalog unavailable", expect.any(Error))
  })
})
