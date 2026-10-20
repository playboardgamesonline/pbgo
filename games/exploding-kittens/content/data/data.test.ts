import { existsSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { assertSeedId, LANGUAGE_IDS } from "@pbgo/content-kit"
import type { LanguageId } from "@pbgo/content-kit"
import { imagesOf, imageValue } from "@pbgo/content-kit/testing"
import type { Doc } from "@pbgo/content-kit/testing"
import { describe, expect, it } from "vitest"
import { CARD_TYPE_KEYS, CARD_TYPES, CATEGORIES, CATEGORY_KEYS, EDITION_KEYS, titleOf } from "../../apps/studio/schemaTypes/constants.ts"
import type { CardTypeKey } from "../../apps/studio/schemaTypes/constants.ts"
import { CONTENT_DIR, DATASET, ENV_FILE, GAME_DIR, PROJECT_ID, REPO_ROOT, SLUG } from "../config.ts"
import { ART_SLOTS } from "./art-manifest.ts"
import { buildCardTypes, cardTypeId, illustrationCount, illustrationKey } from "./card-types.ts"
import { buildOriginalEdition, EDITION_ORIGINAL_ID, ORIGINAL_COPIES } from "./edition.ts"
import { buildGame, GAME_ID } from "./game.ts"
import { buildSettings, RULES_PDF, SETTINGS_ID } from "./settings.ts"
import { seedDocs } from "./test-fixtures.ts"

type LocaleObject = { _type: "localeString" | "localeText" } & Record<LanguageId, string>
// The tests read documents of every shape without a type for each of them
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = { _key: string; _type: string } & Record<string, any>

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

// The keys of GAM-12 and of the engine catalogue (GAM-7): kebab-case, in this order
const ENGINE_KEYS = [
  "exploding-kitten",
  "defuse",
  "attack",
  "skip",
  "favor",
  "shuffle",
  "see-the-future",
  "nope",
  "tacocat",
  "cattermelon",
  "hairy-potato-cat",
  "beard-cat",
  "rainbow-ralphing-cat",
]
const CATS = ["tacocat", "cattermelon", "hairy-potato-cat", "beard-cat", "rainbow-ralphing-cat"] as const

// The category of each card type: the kind it has in the engine catalogue, and the Studio list it is filed in
const CATEGORY_OF: Record<CardTypeKey, string> = {
  "exploding-kitten": "kitten",
  defuse: "defuse",
  attack: "action",
  skip: "action",
  favor: "action",
  shuffle: "action",
  "see-the-future": "action",
  nope: "nope",
  tacocat: "cat",
  cattermelon: "cat",
  "hairy-potato-cat": "cat",
  "beard-cat": "cat",
  "rainbow-ralphing-cat": "cat",
}
// The id of a card type is its category, then `card`, then its key
const CARD_IDS = [
  "kitten-card-exploding-kitten",
  "defuse-card-defuse",
  "action-card-attack",
  "action-card-skip",
  "action-card-favor",
  "action-card-shuffle",
  "action-card-see-the-future",
  "nope-card-nope",
  "cat-card-tacocat",
  "cat-card-cattermelon",
  "cat-card-hairy-potato-cat",
  "cat-card-beard-cat",
  "cat-card-rainbow-ralphing-cat",
]

// The setting-up of the rules, worked out from the copies of the Original Edition: every player starts with 1 Defuse and 7 other cards,
// up to 2 spare Defuses go back into the deck, and the draw pile gets one Exploding Kitten fewer than there are players
const HAND = 7
const KITTENS = ORIGINAL_COPIES["exploding-kitten"]
const DEFUSES = ORIGINAL_COPIES.defuse
const DECK = Object.values(ORIGINAL_COPIES).reduce((sum, copies) => sum + copies, 0)
const pileAtStart = (players: number) => DECK - KITTENS - DEFUSES + Math.min(2, DEFUSES - players) - HAND * players + (players - 1)
const PILE = { 2: pileAtStart(2), 3: pileAtStart(3), 4: pileAtStart(4), 5: pileAtStart(5) }

describe("the seed documents", () => {
  const count = (type: string) => docs().filter((doc) => doc._type === type).length

  it("are the 16 documents of the Original Edition seed", () => {
    expect(docs()).toHaveLength(16)
    expect({
      kittenCard: count("kittenCard"),
      defuseCard: count("defuseCard"),
      actionCard: count("actionCard"),
      nopeCard: count("nopeCard"),
      catCard: count("catCard"),
      edition: count("edition"),
      game: count("game"),
      settings: count("settings"),
    }).toEqual({
      kittenCard: 1,
      defuseCard: 1,
      actionCard: 5,
      nopeCard: 1,
      catCard: 5,
      edition: 1,
      game: 1,
      settings: 1,
    })
    expect(docs().map((doc) => doc._id)).toEqual([...CARD_IDS, "edition-original", "game", "settings"])
  })

  it("seed no rules document: the rules are a link to the publisher's PDF, in the settings", () => {
    expect(docs().filter((doc) => doc._type === "rules" || doc._id === "rules")).toEqual([])
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
    expect({ [GAME_ID]: "game", [SETTINGS_ID]: "settings" }).toEqual({ game: "game", settings: "settings" })
    for (const type of ["game", "settings"]) expect(docs().find((doc) => doc._type === type)?._id).toBe(type)
    expect(EDITION_ORIGINAL_ID).toBe("edition-original")
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

    // Changing one cat must not touch the others
    const tacocat = first.find((doc) => doc._id === cardTypeId("tacocat")) as Doc
    const beardCat = first.find((doc) => doc._id === cardTypeId("beard-cat")) as Doc
    const beardCatName = beardCat.name.fr
    tacocat.name.fr = "changed"
    tacocat.illustrations[0].number = 99
    tacocat.extra = true
    ;(first.find((doc) => doc._id === EDITION_ORIGINAL_ID) as Doc).name.fr = "changed"

    expect(beardCat.name.fr).toBe(beardCatName)
    expect(second).not.toBe(first)
    const untouched = second.find((doc) => doc._id === cardTypeId("tacocat")) as Doc
    expect(untouched.name.fr).toBe("Tacocat")
    expect(untouched.illustrations[0].number).toBe(1)
    expect(untouched).not.toHaveProperty("extra")
    expect(docs()).toStrictEqual(second)
  })

  it("give every item of every list a stable _key and a _type", () => {
    for (const doc of docs()) {
      for (const [field, value] of Object.entries(doc)) {
        if (!Array.isArray(value)) continue
        const items = value as Item[]
        const keys = items.map((item) => item._key)
        for (const key of keys) expect(typeof key === "string" && key.length > 0, `${doc._id}.${field}`).toBe(true)
        expect(new Set(keys).size, `${doc._id}.${field}`).toBe(keys.length)
        for (const item of items) expect(typeof item._type, `${doc._id}.${field}`).toBe("string")
      }
    }
  })
})

describe("the card types", () => {
  const cardTypes = () => buildCardTypes() as Doc[]
  const typeOf = (key: CardTypeKey) => cardTypes().find((doc) => doc.key === key) as Doc

  it("are the 13 types of the engine catalogue, under its kebab-case keys, in its order", () => {
    expect(cardTypes().map((doc) => doc.key)).toEqual(ENGINE_KEYS)
    expect([...CARD_TYPE_KEYS]).toEqual(ENGINE_KEYS)
    for (const key of ENGINE_KEYS) expect(key, key).toMatch(/^[a-z]+(-[a-z]+)*$/)
  })

  it("get the id <category>-card-<key>", () => {
    expect(cardTypes().map((doc) => doc._id)).toEqual(CARD_IDS)
    for (const key of CARD_TYPE_KEYS) expect(cardTypeId(key)).toBe(`${CATEGORY_OF[key]}-card-${key}`)
  })

  it("are filed in a document type per category, the kinds of the engine: a kitten, a defuse, five actions, a nope and five cats", () => {
    for (const doc of cardTypes()) expect(doc._type, doc.key).toBe(`${CATEGORY_OF[doc.key as CardTypeKey]}Card`)
    const count = (type: string) => cardTypes().filter((doc) => doc._type === type).length
    expect({ kittenCard: count("kittenCard"), defuseCard: count("defuseCard"), actionCard: count("actionCard"), nopeCard: count("nopeCard"), catCard: count("catCard") }).toEqual({
      kittenCard: 1,
      defuseCard: 1,
      actionCard: 5,
      nopeCard: 1,
      catCard: 5,
    })
    // The engine's CardKind (GAM-7), same names, in the order of the catalogue; a kind is a category, so no document carries one any more
    expect([...CATEGORY_KEYS]).toEqual(["kitten", "defuse", "action", "nope", "cat"])
    expect(CATEGORY_KEYS.map((category) => CATEGORIES[category].type)).toEqual(["kittenCard", "defuseCard", "actionCard", "nopeCard", "catCard"])
    for (const doc of cardTypes()) expect(doc, doc.key).not.toHaveProperty("kind")
  })

  it("are listed by the Studio in the category they are filed in", () => {
    for (const category of CATEGORY_KEYS) {
      const keys = cardTypes()
        .filter((doc) => doc._type === CATEGORIES[category].type)
        .map((doc) => doc.key)
      expect(keys, category).toEqual(CATEGORIES[category].choices.map((choice) => choice.value))
    }
  })

  it("take their place in the category as `order`, from 0, in the order of the catalogue", () => {
    expect(Object.fromEntries(cardTypes().map((doc) => [doc.key, doc.order]))).toEqual({
      "exploding-kitten": 0,
      defuse: 0,
      attack: 0,
      skip: 1,
      favor: 2,
      shuffle: 3,
      "see-the-future": 4,
      nope: 0,
      tacocat: 0,
      cattermelon: 1,
      "hairy-potato-cat": 2,
      "beard-cat": 3,
      "rainbow-ralphing-cat": 4,
    })
  })

  it("list one illustration per printed face, numbered from 1", () => {
    const counts = cardTypes().map((doc) => (doc.illustrations as Item[]).length)
    expect(counts).toEqual([4, 6, 4, 4, 4, 4, 5, 5, 1, 1, 1, 1, 1])
    expect(counts.reduce((sum, number) => sum + number, 0)).toBe(41)
    for (const doc of cardTypes()) {
      const items = doc.illustrations as Item[]
      expect(illustrationCount(doc.key), doc.key).toBe(items.length)
      expect(items, doc.key).toEqual(items.map((_, index) => ({ _key: `art-${index + 1}`, _type: "illustration", number: index + 1 })))
    }
    expect(illustrationKey(3)).toBe("art-3")
  })

  describe("names", () => {
    it("are a localeString", () => {
      for (const doc of cardTypes()) expect(doc.name._type, doc.key).toBe("localeString")
    })

    it("are, in English, the titles the Studio lists", () => {
      for (const key of CARD_TYPE_KEYS) expect(typeOf(key).name.en, key).toBe(titleOf(CARD_TYPES, key))
    })

    it.each([
      ["defuse", "Kit de désamorçage", "Defuse", "Desactivación", "Entschärfung"],
      ["attack", "Attaque", "Attack", "Ataque", "Angriff"],
      ["skip", "Passe-tour", "Skip", "Salta", "Hops!"],
      ["favor", "Faveur", "Favor", "Favor", "Wunsch"],
      ["shuffle", "Mélange", "Shuffle", "Barajar", "Mischen"],
      ["see-the-future", "Divination", "See the Future", "Ver el futuro", "Blick in die Zukunft"],
      ["nope", "Non", "Nope", "Nope", "NÖ!"],
    ] as const)("translate the %s from the glossary of the rules spec", (key, fr, en, es, de) => {
      expect(typeOf(key).name).toEqual({ _type: "localeString", fr, en, es, de })
    })

    it("keep the English name of the Exploding Kitten and of the five cats in every language", () => {
      for (const key of ["exploding-kitten", ...CATS] as const) {
        const title = titleOf(CARD_TYPES, key)
        expect(typeOf(key).name, key).toEqual({ _type: "localeString", fr: title, en: title, es: title, de: title })
      }
    })

    it("are unique within a language", () => {
      for (const language of LANGUAGE_IDS) {
        const names = cardTypes().map((doc) => doc.name[language] as string)
        expect(new Set(names).size, language).toBe(names.length)
      }
    })
  })

  describe("fields", () => {
    it("are the ones of the Studio form and nothing else: the key, the order, the name and the illustrations", () => {
      for (const doc of cardTypes()) expect(Object.keys(doc).sort(), doc.key).toEqual(["_id", "_type", "illustrations", "key", "name", "order"])
    })

    it("have no effect or rule text: what a card does is the engine's and the publisher's rules", () => {
      for (const doc of cardTypes()) {
        expect(doc, doc.key).not.toHaveProperty("effect")
        expect(doc, doc.key).not.toHaveProperty("rule")
      }
    })
  })
})

describe("the Original Edition", () => {
  const edition = () => buildOriginalEdition() as Doc
  const lines = () => edition().cards as Item[]
  const copiesOf = (key: CardTypeKey) => lines().find((line) => line.cardType === key)?.copies as number

  it("is the document edition-original, keyed original and named in the four languages", () => {
    expect(edition()._id).toBe(EDITION_ORIGINAL_ID)
    expect(edition()._type).toBe("edition")
    expect(edition().key).toBe("original")
    expect(EDITION_KEYS as readonly string[]).toContain(edition().key)
    expect(edition().name).toEqual({ _type: "localeString", fr: "Édition originale", en: "Original Edition", es: "Edición original", de: "Originalausgabe" })
  })

  it("has one line per card type, in the order of the catalogue, keyed by its card type", () => {
    expect(lines().map((line) => line.cardType)).toEqual(ENGINE_KEYS)
    for (const line of lines()) {
      expect(line._key, line.cardType).toBe(line.cardType)
      expect(line._type, line.cardType).toBe("deckCard")
      expect(Number.isInteger(line.copies) && line.copies >= 1, line.cardType).toBe(true)
      expect(line.copies, line.cardType).toBe(ORIGINAL_COPIES[line.cardType as CardTypeKey])
    }
  })

  it("has the copies of the printed deck", () => {
    expect(Object.fromEntries(lines().map((line) => [line.cardType, line.copies]))).toEqual({
      "exploding-kitten": 4,
      defuse: 6,
      attack: 4,
      skip: 4,
      favor: 4,
      shuffle: 4,
      "see-the-future": 5,
      nope: 5,
      tacocat: 4,
      cattermelon: 4,
      "hairy-potato-cat": 4,
      "beard-cat": 4,
      "rainbow-ralphing-cat": 4,
    })
  })

  it("is 56 cards: 4 Exploding Kittens, 6 Defuses and 46 others, 20 of them cats", () => {
    const total = lines().reduce((sum, line) => sum + (line.copies as number), 0)
    expect(total).toBe(56)
    expect(DECK).toBe(56)
    expect(copiesOf("exploding-kitten")).toBe(4)
    expect(copiesOf("defuse")).toBe(6)
    expect(total - copiesOf("exploding-kitten") - copiesOf("defuse")).toBe(46)
    expect(CATS.reduce((sum, key) => sum + copiesOf(key), 0)).toBe(20)
  })

  it("has a printed illustration per copy, except the cats, which share one", () => {
    for (const key of CARD_TYPE_KEYS) expect(illustrationCount(key), key).toBe(CATEGORY_OF[key] === "cat" ? 1 : copiesOf(key))
  })

  it("sets a table of 2 to 5 players the way the rules count it: 35, 29, 23 and 16 cards in the draw pile", () => {
    expect(PILE).toEqual({ 2: 35, 3: 29, 4: 23, 5: 16 })
    // One Exploding Kitten fewer than players goes into the pile: the four of the deck are enough for five players
    expect(KITTENS).toBe(5 - 1)
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
  const CONJUNCTION: Record<LanguageId, string> = { fr: "et", en: "and", es: "y", de: "und" }

  it("hold the credits, the publisher and the English rulebook, and nothing else", () => {
    expect(settings()._id).toBe(SETTINGS_ID)
    expect(Object.keys(settings()).sort()).toEqual(["_id", "_type", "creditsAuthors", "creditsAuthorsI18n", "publisher", "publisherUrl", "rulesPdfEn"])
  })

  it("credit the three authors of the game, in each language with its own conjunction", () => {
    expect(settings().creditsAuthorsI18n._type).toBe("localeString")
    for (const language of LANGUAGE_IDS) {
      expect(settings().creditsAuthorsI18n[language], language).toBe(`Elan Lee, Matthew Inman ${CONJUNCTION[language]} Shane Small`)
    }
    // The footer falls back to the French field when the localized one is empty, so both are filled
    expect(settings().creditsAuthors).toBe(settings().creditsAuthorsI18n.fr)
  })

  it("name the publisher and link to it", () => {
    expect(settings().publisher).toBe("Exploding Kittens Inc.")
    const url = new URL(settings().publisherUrl)
    expect(url.protocol).toBe("https:")
    expect(url.hostname).toBe("www.explodingkittens.com")
  })

  it("link the official English rulebook, never copy it: the other languages fall back to it", () => {
    expect(Object.keys(RULES_PDF)).toEqual(["en"])
    expect(settings().rulesPdfEn).toBe(RULES_PDF.en)
    for (const field of ["rulesPdfFr", "rulesPdfEs", "rulesPdfDe", "rulesPdfFrFile", "rulesPdfEnFile", "rulesPdfEsFile", "rulesPdfDeFile"]) {
      expect(settings(), field).not.toHaveProperty(field)
    }
    const url = new URL(settings().rulesPdfEn)
    expect(url.protocol).toBe("https:")
    expect(url.pathname).toMatch(/\.pdf$/)
    expect(url.search).toBe("")
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
    // 13 card types (name), the edition name, the credits
    expect(objects).toHaveLength(15)
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

  it("keeps a title on one line, and its paragraphs apart by one blank line", () => {
    for (const { where, kind, text } of allTexts()) {
      if (kind === "localeString") expect(text, where).not.toMatch(/[\r\n]/)
      else expect(text, where).not.toMatch(/\r|\n{3}|\n[ \t]+\n/)
    }
  })

  it("has no placeholder, no markup, no address", () => {
    for (const { where, text } of allTexts()) {
      // `todo` is also a Spanish word ("sobre todo"): only the capitalised marker counts
      expect(text, where).not.toMatch(/\bTODO\b/)
      expect(text, where).not.toMatch(/\b(tbd|fixme|lorem|ipsum|placeholder|xxx)\b/i)
      expect(text, where).not.toMatch(/\?\?|…\s*$|<\/?[a-z]|https?:\/\//i)
    }
  })

  it("closes every bold mark", () => {
    for (const { where, text } of allTexts()) expect((text.match(/\*\*/g) ?? []).length % 2, where).toBe(0)
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
  it("points at the Exploding Kittens project of the registry, the single source of project ids", async () => {
    // Loaded by its path, as scripts/lib.sh does: a static import would pull all of @pbgo/core into the typecheck of this folder
    const { GAMES } = (await import(/* @vite-ignore */ join(REPO_ROOT, "packages/games/src/registry.ts"))) as { GAMES: { slug: string; sanityProjectId: string }[] }
    const entries = GAMES.filter((game) => game.slug === SLUG)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.sanityProjectId).toBe(PROJECT_ID)
    expect(PROJECT_ID).toBe("iz9kkgyd")
  })

  it("points at the same project as the studio", () => {
    for (const file of ["sanity.config.ts", "sanity.cli.ts"]) expect(readFileSync(join(GAME_DIR, "apps/studio", file), "utf8"), file).toContain(PROJECT_ID)
  })

  it("writes to the production dataset of the game it lives in", () => {
    expect(DATASET).toBe("production")
    expect(SLUG).toBe("exploding-kittens")
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
  const faces = ART_SLOTS.filter((slot) => CARD_IDS.includes(slot.docId))
  const docOf = (slot: (typeof ART_SLOTS)[number]) => docs().find((candidate) => candidate._id === slot.docId) as Doc

  it("are 46: a face per printed illustration (41), the card back, the box (front and back), the mat and the logo", () => {
    expect(ART_SLOTS).toHaveLength(46)
    expect(faces).toHaveLength(41)
    expect(ART_SLOTS.filter((slot) => slot.docId === GAME_ID).map((slot) => slot.name)).toEqual(["card-back", "box-front", "box-back", "mat"])
    expect(ART_SLOTS.filter((slot) => slot.docId === SETTINGS_ID).map((slot) => slot.name)).toEqual(["logo"])
  })

  it("give each card type as many face slots as it has illustrations", () => {
    for (const key of CARD_TYPE_KEYS) expect(faces.filter((slot) => slot.docId === cardTypeId(key)), key).toHaveLength(illustrationCount(key))
  })

  it("name a face after its card type and number (defuse-3), or after the card type alone for a single face (tacocat)", () => {
    for (const key of CARD_TYPE_KEYS) {
      const count = illustrationCount(key)
      const names = faces.filter((slot) => slot.docId === cardTypeId(key)).map((slot) => slot.name)
      expect(names, key).toEqual(count === 1 ? [key] : Array.from({ length: count }, (_, index) => `${key}-${index + 1}`))
    }
  })

  it("also accept <cat>-1 for a single face and `back` for the card back", () => {
    expect(ART_SLOTS.filter((slot) => slot.aliases?.length).map((slot) => [slot.name, slot.aliases])).toEqual([
      ["tacocat", ["tacocat-1"]],
      ["cattermelon", ["cattermelon-1"]],
      ["hairy-potato-cat", ["hairy-potato-cat-1"]],
      ["beard-cat", ["beard-cat-1"]],
      ["rainbow-ralphing-cat", ["rainbow-ralphing-cat-1"]],
      ["card-back", ["back"]],
    ])
  })

  it("are named in lower-case words joined by hyphens", () => {
    for (const slot of ART_SLOTS) for (const name of [slot.name, ...(slot.aliases ?? [])]) expect(name, name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
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
      if (CARD_IDS.includes(slot.docId) || slot.name === "card-back") expect(slot.ratio, slot.name).toEqual([5, 7])
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
      const placed = imagesOf(doc)
      expect(placed, slot.name).toHaveLength(1)
      expect(placed[0]?.image, slot.name).toEqual(image(slot.name))

      // taking the image out gives the document back as it was
      const copy = JSON.parse(JSON.stringify(doc))
      const target = placed[0]?.path.replace(/^\$\.?/, "") as string
      const segments = target.split(/\.|\[|\]\.?/).filter(Boolean)
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

    it("the illustration, in the document of its category, that carries its number", () => {
      expect(where("exploding-kitten-1")).toBe("kittenCard:$.illustrations[0].image")
      expect(where("defuse-3")).toBe("defuseCard:$.illustrations[2].image")
      expect(where("attack-2")).toBe("actionCard:$.illustrations[1].image")
      expect(where("nope-5")).toBe("nopeCard:$.illustrations[4].image")
      expect(where("tacocat")).toBe("catCard:$.illustrations[0].image")
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

  it("refuse to invent an illustration that the card type does not list", () => {
    const slot = ART_SLOTS.find((candidate) => candidate.name === "defuse-1")
    if (!slot) throw new Error("no slot defuse-1")
    const message = '"defuse-card-defuse" has no item "art-1" in "illustrations"'
    expect(() => slot.place({ _id: "defuse-card-defuse", _type: "defuseCard", illustrations: [] }, image("x"))).toThrow(message)
    expect(() => slot.place({ _id: "defuse-card-defuse", _type: "defuseCard" }, image("x"))).toThrow(message)
  })
})
