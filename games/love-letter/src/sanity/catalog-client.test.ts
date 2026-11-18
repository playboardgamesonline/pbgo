import { CHARACTER_KEYS } from "@love-letter/engine"
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

import { MISSING_CATALOG } from "../lib/catalog"
import { WORD_FIELDS } from "../lib/words"
import { getClientCatalog } from "./catalog-client"

// What a player sees of Love Letter on the table comes from the game's Sanity project: the face of each character with its name and its card text, the back of the cards, the words of the board. A picture it does not have is null, a text it does not have
// in the language asked reads in English, and one that English does not have either reads [missing: <key>]: never another language.

const words = (values: Record<string, string>) => ({ _type: "localeString", ...values })
const picture = (seed: string) => ({ _type: "image", asset: { _type: "reference", _ref: `image-${seed.padEnd(40, "0")}-760x1060-webp` } })

type Character = { key: string; name: ReturnType<typeof words> | null; text: ReturnType<typeof words> | null; image: ReturnType<typeof picture> | null }

/** A project that holds the ten characters with a picture, a name and a text each, the back, and every word of the board in French and English. */
function project() {
  return {
    game: { cardBack: picture("ba") },
    texts: Object.fromEntries(WORD_FIELDS.map((field) => [field, words({ fr: `${field} (fr)`, en: `${field} (en)` })])),
    characters: CHARACTER_KEYS.map(
      (key): Character => ({ key, name: words({ fr: `${key} fr`, en: `${key} en` }), text: { ...words({ fr: `text of ${key} fr`, en: `text of ${key} en` }), _type: "localeText" } as never, image: picture(key) }),
    ),
  }
}

const load = (locale: Locale, context: Partial<LoaderContext> = {}) =>
  getClientCatalog({ game: { slug: "love-letter", sanityProjectId: "8h6tuu2t" }, locale, sanity: {}, ...context } as unknown as LoaderContext)

const errors = vi.spyOn(console, "error").mockImplementation(() => {})

beforeEach(() => {
  sanity.catalog = project()
  sanity.down = false
  errors.mockClear()
})

afterEach(() => errors.mockClear())

describe("the faces of the characters", () => {
  it("are one picture for each character of the engine's catalogue, by its key there", async () => {
    const { faces } = await load("en")
    expect(Object.keys(faces)).toEqual([...CHARACTER_KEYS])
    for (const [key, url] of Object.entries(faces)) expect(url, key).toMatch(/^https:\/\/cdn\.sanity\.io\/images\/8h6tuu2t\/production\/[0-9a-z]+-760x1060\.webp$/)
    expect(faces.guard).toContain("guard0000")
    expect(faces.princess).toContain("princess0000")
  })

  it("are served as the file is: a canvas that reads a picture must not depend on the format the image CDN would pick for the browser", async () => {
    const { faces, backUrl } = await load("en")
    for (const url of [...Object.values(faces), backUrl]) expect(url).not.toContain("?")
  })

  it("are null for a character whose document has no picture yet or is not there at all, and no character is lost", async () => {
    const holding = project()
    holding.characters = holding.characters.filter((character) => character.key !== "king").map((character) => (character.key === "spy" ? { ...character, image: null } : character))
    sanity.catalog = holding
    const { faces } = await load("en")
    expect(faces.spy).toBeNull()
    expect(faces.king).toBeNull()
    expect(faces.guard).not.toBeNull()
    expect(Object.keys(faces)).toHaveLength(CHARACTER_KEYS.length)
  })

  it("ignore a document whose key the engine does not know", async () => {
    const holding = project()
    holding.characters = [...holding.characters, { key: "jester", name: words({ en: "Jester" }), text: null, image: picture("zz") }]
    sanity.catalog = holding
    const catalog = await load("en")
    for (const part of [catalog.faces, catalog.names, catalog.texts]) expect(Object.keys(part)).not.toContain("jester")
  })
})

describe("the back of the cards", () => {
  it("is the picture of the game document, null while it has none", async () => {
    expect((await load("en")).backUrl).toMatch(/cdn\.sanity\.io\/images\/8h6tuu2t\/production\/ba0+-760x1060\.webp$/)
    sanity.catalog = { ...project(), game: null }
    expect((await load("en")).backUrl).toBeNull()
    sanity.catalog = { ...project(), game: { cardBack: null } }
    expect((await load("en")).backUrl).toBeNull()
  })
})

describe("the names and the card texts", () => {
  it("are read in the language asked, else English", async () => {
    expect((await load("fr")).names.guard).toBe("guard fr")
    expect((await load("fr")).texts.guard).toBe("text of guard fr")
    expect((await load("es")).names.guard).toBe("guard en")
    expect((await load("de")).texts.princess).toBe("text of princess en")
  })

  it("read [missing: characters.<key>.name] and [missing: characters.<key>.text] when neither the language asked nor English has one, even if French has", async () => {
    const holding = project()
    holding.characters = holding.characters.map((character) => (character.key === "spy" ? { ...character, name: words({ fr: "Espionne" }), text: { ...words({ fr: "Sans effet." }), _type: "localeText" } as never } : character))
    sanity.catalog = holding
    expect((await load("en")).names.spy).toBe("[missing: characters.spy.name]")
    expect((await load("es")).texts.spy).toBe("[missing: characters.spy.text]")
    expect((await load("fr")).names.spy).toBe("Espionne")
    expect((await load("fr")).texts.spy).toBe("Sans effet.")
  })

  it("read the marker for a character whose document has no text at all", async () => {
    const holding = project()
    holding.characters = holding.characters.map((character) => (character.key === "king" ? { ...character, name: null, text: null } : character))
    sanity.catalog = holding
    const { names, texts } = await load("fr")
    expect(names.king).toBe("[missing: characters.king.name]")
    expect(texts.king).toBe("[missing: characters.king.text]")
  })
})

describe("the words of the board", () => {
  it("are read in the language asked, else English", async () => {
    const fr = await load("fr")
    const es = await load("es")
    expect(fr.words.round).toBe("round (fr)")
    expect(es.words.round).toBe("round (en)")
    expect(Object.keys(fr.words).sort()).toEqual([...WORD_FIELDS].sort())
  })

  it("read [missing: <key>] when English has none either, for the language that has none of its own: never French", async () => {
    sanity.catalog = { ...project(), texts: { out: words({ fr: "Hors manche" }), round: words({ en: "Round {number}" }) } }
    const es = await load("es")
    expect(es.words.out).toBe("[missing: out]")
    expect(es.words.round).toBe("Round {number}")
    expect(es.words.start).toBe("[missing: start]")
    expect((await load("fr")).words.out).toBe("Hors manche")
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
    const ask = () => fresh({ game: { slug: "love-letter", sanityProjectId: "8h6tuu2t" }, locale: "en", sanity: {} } as unknown as LoaderContext)
    await ask()
    await ask()
    const lines = errors.mock.calls.map((call) => String(call[0]))
    expect(lines.filter((line) => line.includes("roundWinner"))).toHaveLength(1)
    expect(lines.find((line) => line.includes("roundWinner"))).toBe("[missing] love-letter (en): roundWinner is not in Sanity")
  })
})

describe("when Sanity is not there", () => {
  it("is the catalog of markers and no picture for a game with no Sanity client", async () => {
    expect(await load("en", { sanity: null })).toEqual(MISSING_CATALOG)
    expect(MISSING_CATALOG.backUrl).toBeNull()
    expect(Object.values(MISSING_CATALOG.faces).every((url) => url === null)).toBe(true)
    expect(MISSING_CATALOG.words.round).toBe("[missing: round]")
    expect(MISSING_CATALOG.names.guard).toBe("[missing: characters.guard.name]")
    expect(MISSING_CATALOG.texts.guard).toBe("[missing: characters.guard.text]")
  })

  it("is the same catalog when Sanity does not answer, and the error is logged", async () => {
    sanity.down = true
    expect(await load("en")).toEqual(MISSING_CATALOG)
    expect(errors).toHaveBeenCalledWith("Sanity catalog unavailable", expect.any(Error))
  })
})
