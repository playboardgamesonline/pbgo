import { existsSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { assertSeedId, LANGUAGE_IDS } from "@pbgo/content-kit"
import type { LanguageId } from "@pbgo/content-kit"
import { imagesOf, imageValue } from "@pbgo/content-kit/testing"
import type { Doc } from "@pbgo/content-kit/testing"
import { describe, expect, it } from "vitest"
import { CATEGORIES, CATEGORY_KEYS, engineKeyOf, titleOf } from "../../apps/studio/schemaTypes/constants.ts"
import { CONTENT_DIR, DATASET, ENV_FILE, GAME_DIR, PROJECT_ID, REPO_ROOT, SLUG } from "../config.ts"
import { ART_SLOTS } from "./art-manifest.ts"
import { buildCards, CARD_LIST, cardId } from "./cards.ts"
import { buildGame, GAME_ID } from "./game.ts"
import { buildSettings, SETTINGS_ID } from "./settings.ts"
import { seedDocs } from "./test-fixtures.ts"

type LocaleObject = { _type: "localeString" | "localeText" } & Record<LanguageId, string>

const docs = seedDocs

/** Every localeString and localeText of a value, with the path where it sits. */
function localeObjects(value: unknown, path: string): { path: string; value: LocaleObject }[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => localeObjects(item, `${path}[${index}]`))
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (record._type === "localeString" || record._type === "localeText") return [{ path, value: record as LocaleObject }]
    return Object.entries(record).flatMap(([key, child]) => localeObjects(child, `${path}.${key}`))
  }
  return []
}
const allLocaleObjects = () => docs().flatMap((doc) => localeObjects(doc, doc._id))
/** Every single text, with the document, field and language it belongs to. */
const allTexts = () =>
  allLocaleObjects().flatMap(({ path, value }) => LANGUAGE_IDS.map((language) => ({ where: `${path}.${language}`, language, kind: value._type, text: value[language] })))

// The keys of the engine catalogue (`CARDS` of @flip-7/engine): kebab-case, in this order. `parity/engine.test.ts` reads them from the engine itself.
const ENGINE_KEYS = [
  ...Array.from({ length: 13 }, (_, value) => `number-${value}`),
  "plus-2",
  "plus-4",
  "plus-6",
  "plus-8",
  "plus-10",
  "times-2",
  "freeze",
  "flip-three",
  "second-chance",
]
// The cards of each category under the key the Studio lists, each in the order of the engine catalogue.
const NUMBERS = Array.from({ length: 13 }, (_, value) => String(value))
const ACTIONS = ["freeze", "flip-three", "second-chance"]
const MODIFIERS = ["plus-2", "plus-4", "plus-6", "plus-8", "plus-10", "times-2"]
const TYPES = { number: "numberCard", action: "actionCard", modifier: "modifierCard" }

describe("the seed documents", () => {
  const count = (type: string) => docs().filter((doc) => doc._type === type).length

  it("are the 24 documents of the Flip 7 seed: 22 cards in three categories, the game and the settings", () => {
    expect(docs()).toHaveLength(24)
    expect({ numberCard: count("numberCard"), actionCard: count("actionCard"), modifierCard: count("modifierCard"), game: count("game"), settings: count("settings") }).toEqual({
      numberCard: 13,
      actionCard: 3,
      modifierCard: 6,
      game: 1,
      settings: 1,
    })
    expect(docs().map((doc) => doc._id)).toEqual([
      ...NUMBERS.map((key) => `number-card-${key}`),
      ...ACTIONS.map((key) => `action-card-${key}`),
      ...MODIFIERS.map((key) => `modifier-card-${key}`),
      "game",
      "settings",
    ])
  })

  it("have unique ids", () => {
    const ids = docs().map((doc) => doc._id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("have plain published ids: the runner makes the drafts", () => {
    for (const { _id } of docs()) {
      expect(() => assertSeedId(_id), _id).not.toThrow()
      expect(_id.startsWith("drafts.") || _id.startsWith("versions."), _id).toBe(false)
    }
  })

  it("keep the game and the settings as singletons under the id of their type", () => {
    for (const type of ["game", "settings"]) expect(docs().find((doc) => doc._type === type)?._id).toBe(type)
    expect([GAME_ID, SETTINGS_ID]).toEqual(["game", "settings"])
  })

  it("hold content only: no system field, no image (the art comes with the files)", () => {
    for (const doc of docs()) {
      for (const field of ["_rev", "_createdAt", "_updatedAt"]) expect(doc, `${doc._id} ${field}`).not.toHaveProperty(field)
      expect(imagesOf(doc), doc._id).toEqual([])
    }
  })

  it("are plain JSON", () => {
    const all = docs()
    expect(JSON.parse(JSON.stringify(all))).toStrictEqual(all)
  })

  it("are built afresh each time, so that a run can never alter the next one", () => {
    const first = docs()
    const second = docs()
    expect(second).toStrictEqual(first)

    // Changing a card of a run must touch neither another card of that run nor the data the next run is built from
    const three = first.find((doc) => doc._id === cardId("number", "3")) as Doc
    const four = first.find((doc) => doc._id === cardId("number", "4")) as Doc
    three.name.fr = "changed"
    three.extra = true

    expect(four.name.fr).toBe("4")
    const untouched = second.find((doc) => doc._id === cardId("number", "3")) as Doc
    expect(untouched.name.fr).toBe("3")
    expect(untouched).not.toHaveProperty("extra")
    expect(docs()).toStrictEqual(second)
  })
})

describe("the cards", () => {
  const cards = () => buildCards() as Doc[]
  const ofType = (type: string) => cards().filter((doc) => doc._type === type)
  const cardOf = (type: string, key: string) => ofType(type).find((doc) => doc.key === key) as Doc
  const label = (doc: Doc) => `${doc._type} ${doc.key}`

  it("come in three categories, one document type each, listed in this order in the Studio: number, action, modifier", () => {
    expect([...CATEGORY_KEYS]).toEqual(["number", "action", "modifier"])
    expect(CATEGORY_KEYS.map((category) => CATEGORIES[category].type)).toEqual(Object.values(TYPES))
    expect(cards().map((doc) => doc._type)).toEqual([...NUMBERS.map(() => "numberCard"), ...ACTIONS.map(() => "actionCard"), ...MODIFIERS.map(() => "modifierCard")])
  })

  it("are the 22 cards of the engine catalogue: 13 numbers, 3 action cards and 6 score modifiers", () => {
    expect({ numberCard: ofType("numberCard").length, actionCard: ofType("actionCard").length, modifierCard: ofType("modifierCard").length }).toEqual({ numberCard: 13, actionCard: 3, modifierCard: 6 })
    // Every key of the engine catalogue is there once, whatever the category it sits in
    expect(CARD_LIST.map((card) => card.engineKey).sort()).toEqual([...ENGINE_KEYS].sort())
  })

  it("are listed under the simplest key of their category: the figure of a number, the key of the catalogue for an action card or a modifier", () => {
    expect(ofType("numberCard").map((doc) => doc.key)).toEqual(NUMBERS)
    expect(ofType("actionCard").map((doc) => doc.key)).toEqual(ACTIONS)
    expect(ofType("modifierCard").map((doc) => doc.key)).toEqual(MODIFIERS)
    for (const doc of ofType("numberCard")) expect(doc.key, label(doc)).toMatch(/^(0|[1-9]\d*)$/)
    for (const doc of [...ofType("actionCard"), ...ofType("modifierCard")]) expect(doc.key, label(doc)).toMatch(/^[a-z]+(-[a-z0-9]+)*$/)
  })

  it("map back to the key of the engine catalogue, and follow its order within their category", () => {
    expect(engineKeyOf("number", "7")).toBe("number-7")
    expect(engineKeyOf("action", "freeze")).toBe("freeze")
    expect(engineKeyOf("modifier", "plus-4")).toBe("plus-4")
    const engineKeys = (category: string) => CARD_LIST.filter((card) => card.category === category).map((card) => card.engineKey)
    expect(engineKeys("number")).toEqual(ENGINE_KEYS.filter((key) => key.startsWith("number-")))
    expect(engineKeys("modifier")).toEqual(ENGINE_KEYS.filter((key) => MODIFIERS.includes(key)))
    expect(engineKeys("action")).toEqual(ENGINE_KEYS.filter((key) => ACTIONS.includes(key)))
  })

  it("get the id <category>-card-<key>", () => {
    expect(cards().map((doc) => doc._id)).toEqual([...NUMBERS.map((key) => `number-card-${key}`), ...ACTIONS.map((key) => `action-card-${key}`), ...MODIFIERS.map((key) => `modifier-card-${key}`)])
    expect(cardId("number", "7")).toBe("number-card-7")
    expect(cardId("action", "freeze")).toBe("action-card-freeze")
    expect(cardId("modifier", "plus-4")).toBe("modifier-card-plus-4")
    expect(CARD_LIST.map((card) => card.id)).toEqual(cards().map((doc) => doc._id))
  })

  it("have no kind: the category says it", () => {
    for (const doc of cards()) expect(doc, label(doc)).not.toHaveProperty("kind")
  })

  it("have no effect text: what a card does is the engine's, and the rules are the publisher's PDFs", () => {
    for (const doc of cards()) {
      expect(doc, label(doc)).not.toHaveProperty("effect")
      expect(doc, label(doc)).not.toHaveProperty("rule")
    }
  })

  it("hold the fields of the Studio form and nothing else", () => {
    for (const doc of cards()) expect(Object.keys(doc).sort(), label(doc)).toEqual(["_id", "_type", "copies", "key", "name", "order"])
  })

  it("carry their place in their category, from 0, so that the Studio lists them in the order of the deck", () => {
    for (const type of Object.values(TYPES)) {
      const orders = ofType(type).map((doc) => doc.order)
      expect(orders, type).toEqual(orders.map((_, index) => index))
    }
  })

  it("carry the copies of the box: as many of a number as its value and a single 0, one of each modifier, three of each action card", () => {
    for (let value = 1; value <= 12; value++) expect(cardOf("numberCard", String(value)).copies, `number ${value}`).toBe(value)
    expect(cardOf("numberCard", "0").copies).toBe(1)
    for (const key of MODIFIERS) expect(cardOf("modifierCard", key).copies, key).toBe(1)
    for (const key of ACTIONS) expect(cardOf("actionCard", key).copies, key).toBe(3)
  })

  it("make the 94 cards of the box: 79 numbers, 9 action cards and 6 score modifiers (booklet pages 2 and 3)", () => {
    const copies = (type: string) => ofType(type).reduce((total, doc) => total + (doc.copies as number), 0)
    expect({ numberCard: copies("numberCard"), actionCard: copies("actionCard"), modifierCard: copies("modifierCard") }).toEqual({ numberCard: 79, actionCard: 9, modifierCard: 6 })
    expect(cards().reduce((total, doc) => total + (doc.copies as number), 0)).toBe(94)
  })

  describe("names", () => {
    it("are a localeString", () => {
      for (const doc of cards()) expect(doc.name._type, label(doc)).toBe("localeString")
    })

    it("are the figure on the card for the numbers and the modifiers, and the printed English title for the action cards, in every language", () => {
      for (const language of LANGUAGE_IDS) {
        for (let value = 0; value <= 12; value++) expect(cardOf("numberCard", String(value)).name[language], `number ${value} ${language}`).toBe(String(value))
        for (const points of [2, 4, 6, 8, 10]) expect(cardOf("modifierCard", `plus-${points}`).name[language], `plus-${points} ${language}`).toBe(`+${points}`)
        expect(cardOf("modifierCard", "times-2").name[language]).toBe("x2")
        expect(cardOf("actionCard", "freeze").name[language]).toBe("Freeze")
        expect(cardOf("actionCard", "flip-three").name[language]).toBe("Flip Three")
        expect(cardOf("actionCard", "second-chance").name[language]).toBe("Second Chance")
      }
    })

    it("are the titles the Studio lists for the key of the card", () => {
      for (const category of CATEGORY_KEYS) {
        for (const doc of ofType(CATEGORIES[category].type)) expect(doc.name.en, label(doc)).toBe(titleOf(CATEGORIES[category].choices, doc.key))
      }
    })

    it("are unique within a language", () => {
      for (const language of LANGUAGE_IDS) {
        const names = cards().map((doc) => doc.name[language] as string)
        expect(new Set(names).size, language).toBe(names.length)
      }
    })
  })
})

describe("the game", () => {
  it("is an empty singleton: its images (card back, box, mat) come with the art", () => {
    expect(GAME_ID).toBe("game")
    expect(buildGame()).toEqual({ _id: "game", _type: "game" })
  })
})

describe("the settings", () => {
  const settings = () => buildSettings() as Doc

  it("hold the credits and the publisher, and nothing else", () => {
    expect(Object.keys(settings()).sort()).toEqual(["_id", "_type", "creditsAuthors", "creditsAuthorsI18n", "publisher", "publisherUrl"])
    expect(settings()._id).toBe(SETTINGS_ID)
    expect(settings()._type).toBe("settings")
  })

  it("credit the author of the game, Eric Olsen, in every language", () => {
    expect(settings().creditsAuthorsI18n._type).toBe("localeString")
    for (const language of LANGUAGE_IDS) expect(settings().creditsAuthorsI18n[language], language).toBe("Eric Olsen")
    // The footer falls back to the French field when the localized one is empty, so both are filled
    expect(settings().creditsAuthors).toBe(settings().creditsAuthorsI18n.fr)
  })

  it("name the publisher of the booklet and link to it", () => {
    expect(settings().publisher).toBe("The OP Games")
    const url = new URL(settings().publisherUrl)
    expect(url.protocol).toBe("https:")
    expect(url.hostname).toBe("www.theopgames.com")
  })

  it("leave the rulebook link to the Studio: the booklet has no address of its own to link", () => {
    for (const field of ["rulesPdfFr", "rulesPdfEn", "rulesPdfEs", "rulesPdfDe", "rulesPdfFrFile", "rulesPdfEnFile", "rulesPdfEsFile", "rulesPdfDeFile"]) {
      expect(settings(), field).not.toHaveProperty(field)
    }
  })

  it("hold short strings only", () => {
    for (const [field, value] of Object.entries(settings())) {
      if (typeof value === "string") expect(value.length, field).toBeLessThan(200)
    }
  })
})

describe("every text", () => {
  it("is in the four languages, for every localeString and localeText of every document", () => {
    const objects = allLocaleObjects()
    // the names of the 22 cards and the credits
    expect(objects).toHaveLength(23)
    for (const { path, value } of objects) expect(Object.keys(value).sort(), path).toEqual(["_type", ...LANGUAGE_IDS].sort())
  })

  it("has no space around it, no double space, no tab", () => {
    for (const { where, text } of allTexts()) {
      expect(text, where).toBe(text.trim())
      expect(text, where).not.toMatch(/ {2}|\t/)
    }
  })

  it("uses the typographic apostrophe, never the straight one", () => {
    for (const { where, text } of allTexts()) expect(text, where).not.toContain("'")
  })

  it("keeps a title on one line", () => {
    for (const { where, kind, text } of allTexts()) if (kind === "localeString") expect(text, where).not.toMatch(/[\r\n]/)
  })

  it("has no placeholder, no markup, no address", () => {
    for (const { where, text } of allTexts()) {
      // `todo` is also a Spanish word ("sobre todo"): only the capitalised marker counts
      expect(text, where).not.toMatch(/\bTODO\b/)
      expect(text, where).not.toMatch(/\b(tbd|fixme|lorem|ipsum|placeholder|xxx)\b/i)
      expect(text, where).not.toMatch(/\?\?|…\s*$|<\/?[a-z]|https?:\/\//i)
    }
  })

  it("is written in its own language: no long text is the same in two languages", () => {
    for (const { path, value } of allLocaleObjects()) {
      const longOnes = LANGUAGE_IDS.map((language) => value[language]).filter((text) => text.length >= 30)
      expect(new Set(longOnes).size, path).toBe(longOnes.length)
    }
  })

  it("is at most 4 000 characters, so that a Studio text field stays readable", () => {
    for (const { where, text } of allTexts()) expect(text.length, where).toBeLessThan(4000)
  })
})

describe("the configuration", () => {
  it("points at the Flip 7 project of the registry, the single source of project ids", async () => {
    // Loaded by its path, as scripts/lib.sh does: a static import would pull all of @pbgo/core into the typecheck of this folder
    const { GAMES } = (await import(/* @vite-ignore */ join(REPO_ROOT, "packages/games/src/registry.ts"))) as { GAMES: { slug: string; sanityProjectId: string }[] }
    const entries = GAMES.filter((game) => game.slug === SLUG)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.sanityProjectId).toBe(PROJECT_ID)
    expect(PROJECT_ID).toBe("ky3exlhe")
  })

  it("points at the same project as the studio", () => {
    for (const file of ["sanity.config.ts", "sanity.cli.ts"]) expect(readFileSync(join(GAME_DIR, "apps/studio", file), "utf8"), file).toContain(PROJECT_ID)
  })

  it("writes to the production dataset of the game it lives in", () => {
    expect(DATASET).toBe("production")
    expect(SLUG).toBe("flip-7")
    expect(basename(GAME_DIR)).toBe(SLUG)
    expect(basename(CONTENT_DIR)).toBe("content")
  })

  it("finds the repository root, and the env file where the web app keeps it", () => {
    expect(existsSync(join(REPO_ROOT, "pnpm-workspace.yaml"))).toBe(true)
    expect(ENV_FILE).toBe(join(REPO_ROOT, "apps/web/.env.local"))
  })
})

describe("the art slots", () => {
  const image = imageValue
  const isFace = (slot: (typeof ART_SLOTS)[number]) => slot.docId.includes("-card-")
  const faces = ART_SLOTS.filter(isFace)
  const docOf = (slot: (typeof ART_SLOTS)[number]) => docs().find((candidate) => candidate._id === slot.docId) as Doc

  it("are 27: one per card (22), the card back, the box (front and back), the mat and the logo", () => {
    expect(ART_SLOTS).toHaveLength(27)
    expect(faces).toHaveLength(22)
    expect(ART_SLOTS.filter((slot) => slot.docId === GAME_ID).map((slot) => slot.name)).toEqual(["card-back", "box-front", "box-back", "mat"])
    expect(ART_SLOTS.filter((slot) => slot.docId === SETTINGS_ID).map((slot) => slot.name)).toEqual(["logo"])
  })

  it("name each face after the key of the engine catalogue (number-7, plus-4, times-2, freeze…), category by category as the Studio lists them", () => {
    expect(faces.map((slot) => slot.name)).toEqual([...NUMBERS.map((key) => `number-${key}`), ...ACTIONS, ...MODIFIERS])
    expect(faces.map((slot) => slot.docId)).toEqual([...NUMBERS.map((key) => `number-card-${key}`), ...ACTIONS.map((key) => `action-card-${key}`), ...MODIFIERS.map((key) => `modifier-card-${key}`)])
  })

  it("also accept the figure printed on the card (7, +4, x2) and `back` for the card back", () => {
    const aliases = Object.fromEntries(ART_SLOTS.filter((slot) => slot.aliases?.length).map((slot) => [slot.name, slot.aliases]))
    expect(aliases).toEqual({
      ...Object.fromEntries(Array.from({ length: 13 }, (_, value) => [`number-${value}`, [String(value)]])),
      "plus-2": ["+2"],
      "plus-4": ["+4"],
      "plus-6": ["+6"],
      "plus-8": ["+8"],
      "plus-10": ["+10"],
      "times-2": ["x2"],
      "card-back": ["back"],
    })
  })

  it("are named in lower-case words joined by hyphens, a figure or a sign included", () => {
    for (const slot of ART_SLOTS) for (const name of [slot.name, ...(slot.aliases ?? [])]) expect(name, name).toMatch(/^\+?[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("share no name, aliases included", () => {
    const names = ART_SLOTS.flatMap((slot) => [slot.name, ...(slot.aliases ?? [])])
    expect(new Set(names).size).toBe(names.length)
  })

  it("have a label and a sensible size", () => {
    for (const slot of ART_SLOTS) {
      expect(slot.label.length, slot.name).toBeGreaterThan(3)
      expect(slot.maxSize, slot.name).toBeGreaterThanOrEqual(256)
      expect(slot.maxSize, slot.name).toBeLessThanOrEqual(2400)
    }
    const labels = ART_SLOTS.map((slot) => slot.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("ask for the proportions of a card (5:7) on the faces and the back, and for none on the rest", () => {
    for (const slot of ART_SLOTS) {
      if (isFace(slot) || slot.name === "card-back") expect(slot.ratio, slot.name).toEqual([5, 7])
      else expect(slot.ratio, slot.name).toBeUndefined()
    }
  })

  it("all aim at a document of the seed", () => {
    const ids = new Set(docs().map((doc) => doc._id))
    for (const slot of ART_SLOTS) expect(ids.has(slot.docId), slot.name).toBe(true)
  })

  it("put the image in one field of their document, and nowhere else", () => {
    for (const slot of ART_SLOTS) {
      const doc = docOf(slot)
      const before = JSON.parse(JSON.stringify(doc))
      slot.place(doc, image(slot.name))
      expect(imagesOf(before), slot.name).toEqual([])
      expect(imagesOf(doc), slot.name).toHaveLength(1)
      // everything but that field is as it was
      const copy = JSON.parse(JSON.stringify(doc))
      const path = imagesOf(doc)[0]!.path
      const segments = path.replace(/^\$\./, "").split(".")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let holder: any = copy
      for (const segment of segments.slice(0, -1)) holder = holder[segment]
      delete holder[segments.at(-1) as string]
      expect(copy, slot.name).toEqual(before)
    }
  })

  describe("aim at", () => {
    const where = (name: string) => {
      const slot = ART_SLOTS.find((candidate) => candidate.name === name)
      if (!slot) throw new Error(`no slot ${name}`)
      const doc = docOf(slot)
      slot.place(doc, image(name))
      return `${doc._type}:${imagesOf(doc)[0]?.path}`
    }

    it("the image of the card face that carries its key, in the document type of its category", () => {
      expect(where("number-0")).toBe("numberCard:$.image")
      expect(where("number-7")).toBe("numberCard:$.image")
      expect(where("number-12")).toBe("numberCard:$.image")
      for (const name of ["freeze", "flip-three", "second-chance"]) expect(where(name)).toBe("actionCard:$.image")
      for (const name of ["plus-2", "plus-4", "plus-10", "times-2"]) expect(where(name)).toBe("modifierCard:$.image")
    })

    it("the images of the game singleton and the shared logo of the settings", () => {
      expect(where("card-back")).toBe("game:$.cardBack")
      expect(where("box-front")).toBe("game:$.boxFront")
      expect(where("box-back")).toBe("game:$.boxBack")
      expect(where("mat")).toBe("game:$.mat")
      expect(where("logo")).toBe("settings:$.logo")
    })

    it("a field of its own: no two slots aim at the same one", () => {
      const targets = ART_SLOTS.map((slot) => {
        const doc = docOf(slot)
        slot.place(doc, image(slot.name))
        return `${doc._id}${imagesOf(doc)[0]?.path}`
      })
      expect(new Set(targets).size).toBe(targets.length)
    })
  })
})
