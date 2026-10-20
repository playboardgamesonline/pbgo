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
import { buildRules, RULES_ID, RULES_SECTION_KEYS } from "./rules.ts"
import { buildSettings, RULES_PDF, SETTINGS_ID } from "./settings.ts"
import { seedDocs } from "./test-fixtures.ts"

type LocaleObject = { _type: "localeString" | "localeText" } & Record<LanguageId, string>
// The tests read documents of every shape without a type for each of them
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = { _key: string; _type: string } & Record<string, any>

const docs = seedDocs
const sorted = (numbers: number[]) => [...numbers].sort((a, b) => a - b)
const digitsOf = (text: string) => sorted((text.match(/\d+/g) ?? []).map(Number))
const paragraphsOf = (text: string) => text.split("\n\n")
/** The bold label that opens a paragraph, without its closing full stop (`Hops!` and `NÖ!` keep their own mark). */
const labelOf = (paragraph: string) => (paragraph.match(/^\*\*(.+?)\*\*/)?.[1] ?? "").replace(/\.$/, "")

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

const rulesDoc = () => buildRules() as Doc
const sectionOf = (key: string) => (rulesDoc().sections as Item[]).find((section) => section._key === key) as Item
const wholeRules = (language: LanguageId) => [rulesDoc().intro[language], ...(rulesDoc().sections as Item[]).map((section) => section.body[language])].join("\n\n")

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

  it("are the 17 documents of the Original Edition seed", () => {
    expect(docs()).toHaveLength(17)
    expect({
      kittenCard: count("kittenCard"),
      defuseCard: count("defuseCard"),
      actionCard: count("actionCard"),
      nopeCard: count("nopeCard"),
      catCard: count("catCard"),
      edition: count("edition"),
      game: count("game"),
      rules: count("rules"),
      settings: count("settings"),
    }).toEqual({
      kittenCard: 1,
      defuseCard: 1,
      actionCard: 5,
      nopeCard: 1,
      catCard: 5,
      edition: 1,
      game: 1,
      rules: 1,
      settings: 1,
    })
    expect(docs().map((doc) => doc._id)).toEqual([...CARD_IDS, "edition-original", "game", "rules", "settings"])
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

  it("keep the game, the rules and the settings as singletons under the id of their type", () => {
    expect({ [GAME_ID]: "game", [RULES_ID]: "rules", [SETTINGS_ID]: "settings" }).toEqual({ game: "game", rules: "rules", settings: "settings" })
    for (const type of ["game", "rules", "settings"]) expect(docs().find((doc) => doc._type === type)?._id).toBe(type)
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

    // The five cats share one effect text in the data: changing one cat must not touch the others
    const tacocat = first.find((doc) => doc._id === cardTypeId("tacocat")) as Doc
    const beardCat = first.find((doc) => doc._id === cardTypeId("beard-cat")) as Doc
    const effect = beardCat.effect.fr
    tacocat.name.fr = "changed"
    tacocat.effect.fr = "changed"
    tacocat.illustrations[0].number = 99
    tacocat.extra = true
    ;(first.find((doc) => doc._id === RULES_ID) as Doc).intro.fr = "changed"

    expect(beardCat.effect.fr).toBe(effect)
    expect(second).not.toBe(first)
    const untouched = second.find((doc) => doc._id === cardTypeId("tacocat")) as Doc
    expect(untouched.name.fr).toBe("Tacocat")
    expect(untouched.effect.fr).toBe(effect)
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
    it("are a localeString for the name and a localeText for the effect", () => {
      for (const doc of cardTypes()) {
        expect(doc.name._type, doc.key).toBe("localeString")
        expect(doc.effect._type, doc.key).toBe("localeText")
      }
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

  describe("effects", () => {
    it("are one short paragraph that ends with a full stop", () => {
      for (const doc of cardTypes()) {
        for (const language of LANGUAGE_IDS) {
          const text = doc.effect[language] as string
          expect(text, `${doc.key} ${language}`).not.toContain("\n")
          expect(text, `${doc.key} ${language}`).toMatch(/\.$/)
          expect(text.length, `${doc.key} ${language}`).toBeLessThan(300)
        }
      }
    })

    it("give the same figures in every language: the 2 turns of the Attack, the 3 cards of See the Future", () => {
      for (const doc of cardTypes()) {
        const expected = doc.key === "attack" ? [2] : doc.key === "see-the-future" ? [3] : []
        for (const language of LANGUAGE_IDS) expect(digitsOf(doc.effect[language]), `${doc.key} ${language}`).toEqual(expected)
      }
    })

    it("are one and the same for the five cats, and their own for the eight other types", () => {
      for (const key of CATS) expect(typeOf(key).effect, key).toEqual(typeOf("tacocat").effect)
      for (const language of LANGUAGE_IDS) {
        const others = cardTypes()
          .filter((doc) => doc._type !== "catCard")
          .map((doc) => doc.effect[language] as string)
        expect(others, language).toHaveLength(8)
        expect(new Set([...others, typeOf("tacocat").effect[language]]).size, language).toBe(9)
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

describe("the rules", () => {
  const keys = ["intro", ...RULES_SECTION_KEYS]
  const textOf = (key: string, language: LanguageId): string => (key === "intro" ? rulesDoc().intro[language] : sectionOf(key).body[language])

  // Figures of each paragraph, in French; the other languages must agree with them
  const FIGURES: Record<string, number[][]> = {
    intro: [[2, 5, 15]],
    goal: [[], []],
    setup: [[2, 4, 5, 6], [7, 8], [2, 4, 5], [2, 3, 4, 5, 16, 23, 29, 35]],
    turn: [[], [], []],
    explosion: [[], [], []],
    cards: [[], [2], [], [], [], [3], [], [4]],
    combos: [[], [2], [3], [5]],
    nope: [[], [], [3, 5, 5, 8], [], [], []],
    attack: [[2, 2], [2, 3, 4, 4, 6], []],
    end: [[2], [], [], []],
    online: [[], [3], [], []],
  }

  it("is one document with an introduction and ten sections, in this order", () => {
    expect(Object.keys(rulesDoc()).sort()).toEqual(["_id", "_type", "intro", "sections"])
    expect(rulesDoc()._id).toBe(RULES_ID)
    expect(rulesDoc().intro._type).toBe("localeText")
    expect((rulesDoc().sections as Item[]).map((section) => section._key)).toEqual(["goal", "setup", "turn", "explosion", "cards", "combos", "nope", "attack", "end", "online"])
    expect(RULES_SECTION_KEYS).toEqual((rulesDoc().sections as Item[]).map((section) => section._key))
    expect(Object.keys(FIGURES)).toEqual(keys)
  })

  it("gives every section a title and a body, in the four languages", () => {
    for (const section of rulesDoc().sections as Item[]) {
      expect(section._type, section._key).toBe("section")
      expect(section.title._type, section._key).toBe("localeString")
      expect(section.body._type, section._key).toBe("localeText")
      for (const language of LANGUAGE_IDS) {
        expect(section.title[language].length, `${section._key} ${language}`).toBeGreaterThan(2)
        expect(section.body[language].length, `${section._key} ${language}`).toBeGreaterThan(40)
      }
    }
  })

  it.each([
    ["goal", "But du jeu", "Goal", "Objetivo", "Ziel"],
    ["setup", "Mise en place", "Setup", "Preparación", "Vorbereitung"],
    ["turn", "Le tour de jeu", "Your turn", "El turno", "Der Spielzug"],
    ["explosion", "Explosion et désamorçage", "Exploding and defusing", "Explosión y desactivación", "Explosion und Entschärfung"],
    ["cards", "Les cartes", "The cards", "Las cartas", "Die Karten"],
    ["combos", "Les combinaisons", "Combinations", "Combinaciones", "Kombinationen"],
    ["nope", "La fenêtre de Non", "The Nope window", "La ventana de Nope", "Das Nö-Fenster"],
    ["attack", "Attaques en chaîne", "Stacked attacks", "Ataques en cadena", "Angriffe in Serie"],
    ["end", "Fin de partie", "End of the game", "Fin de la partida", "Spielende"],
    ["online", "Jouer en ligne", "Playing online", "Jugar en línea", "Online spielen"],
  ] as const)("titles the section %s", (key, fr, en, es, de) => {
    expect(sectionOf(key).title).toEqual({ _type: "localeString", fr, en, es, de })
  })

  describe("in the four languages", () => {
    it.each(Object.entries(FIGURES))("%s has the paragraphs and the figures of the rules", (key, expected) => {
      expect(paragraphsOf(textOf(key, "fr")).map(digitsOf)).toEqual(expected)
    })

    it.each(keys)("%s has the same number of paragraphs", (key) => {
      const expected = paragraphsOf(textOf(key, "fr")).length
      for (const language of LANGUAGE_IDS) expect(paragraphsOf(textOf(key, language)), `${key} ${language}`).toHaveLength(expected)
    })

    it.each(keys)("%s has the same number of bold marks", (key) => {
      const marks = (language: LanguageId) => (textOf(key, language).match(/\*\*/g) ?? []).length
      expect(marks("fr") % 2).toBe(0)
      for (const language of LANGUAGE_IDS) expect(marks(language), `${key} ${language}`).toBe(marks("fr"))
    })

    it.each(keys)("%s gives the same figures in each paragraph", (key) => {
      const paragraphs = (language: LanguageId) => paragraphsOf(textOf(key, language))
      paragraphs("fr").forEach((paragraph, index) => {
        for (const language of LANGUAGE_IDS) expect(digitsOf(paragraphs(language)[index] as string), `${key} ¶${index + 1} ${language}`).toEqual(digitsOf(paragraph))
      })
    })

    it("keeps the bold for the labels of the cards and of the combinations, one label at the head of each entry", () => {
      const bold = Object.fromEntries(keys.map((key) => [key, (textOf(key, "fr").match(/\*\*/g) ?? []).length]))
      expect(bold).toEqual({ intro: 0, goal: 0, setup: 0, turn: 0, explosion: 0, cards: 14, combos: 6, nope: 0, attack: 0, end: 0, online: 0 })
      for (const language of LANGUAGE_IDS) {
        for (const key of ["cards", "combos"]) {
          const [lead, ...entries] = paragraphsOf(textOf(key, language))
          expect(lead, `${key} ${language}`).not.toContain("**")
          for (const entry of entries) {
            expect(entry, `${key} ${language}`).toMatch(/^\*\*[^*]+\*\* \S/)
            expect((entry.match(/\*\*/g) ?? []).length, `${key} ${language}`).toBe(2)
          }
        }
      }
    })

    it.each([
      ["fr", ["pioche", "défausse", "fenêtre de Non", "Deux pareilles", "Trois pareilles", "Kit de désamorçage"]],
      ["en", ["draw pile", "discard pile", "Nope window", "Pair", "Three of a kind"]],
      ["es", ["mazo", "descarte", "ventana de Nope", "Pareja", "Trío"]],
      ["de", ["Spielstapel", "Ablagestapel", "Nö-Fenster", "Pärchen", "Drilling", "Fünfling"]],
    ] as const)("uses the vocabulary of the glossary in %s", (language, terms) => {
      for (const term of terms) expect(wholeRules(language), term).toContain(term)
    })
  })

  describe("figures and options that the engine and the lobby rely on", () => {
    const DEAL: Record<LanguageId, string> = {
      fr: `${PILE[2]} cartes avec 2 joueurs, ${PILE[3]} avec 3 joueurs, ${PILE[4]} avec 4 joueurs et ${PILE[5]} avec 5 joueurs`,
      en: `${PILE[2]} cards with 2 players, ${PILE[3]} with 3, ${PILE[4]} with 4 and ${PILE[5]} with 5`,
      es: `${PILE[2]} cartas con 2 jugadores, ${PILE[3]} con 3, ${PILE[4]} con 4 y ${PILE[5]} con 5`,
      de: `${PILE[2]} Karten bei 2 Personen, ${PILE[3]} bei 3, ${PILE[4]} bei 4 und ${PILE[5]} bei 5`,
    }
    const SETUP: Record<LanguageId, string[]> = {
      fr: [`${KITTENS} Exploding Kittens`, `${DEFUSES} Kits de désamorçage`, `chaque joueur en reçoit ${HAND}`, `compte donc ${HAND + 1} cartes`],
      en: [`the ${KITTENS} Exploding Kittens and the ${DEFUSES} Defuses`, `every player is dealt ${HAND} of them`, `a starting hand has ${HAND + 1} cards`],
      es: [`los ${KITTENS} Exploding Kittens y las ${DEFUSES} Desactivaciones`, `cada jugador recibe ${HAND}`, `la mano inicial tiene ${HAND + 1} cartas`],
      de: [`die ${KITTENS} Exploding Kittens und die ${DEFUSES} Entschärfungen`, `jede Person bekommt ${HAND}`, `die Starthand also aus ${HAND + 1} Karten`],
    }
    const WORDING: Record<LanguageId, string[]> = {
      fr: [
        // the Nope window: 5 seconds by default, 3, 5 or 8 chosen in the lobby
        "Elle dure 5 secondes par défaut ; l’hôte peut choisir 3, 5 ou 8 secondes avant la partie.",
        // the combination of five different cards is on by default, like the engine's `fiveDifferent`; the host can turn it off
        "**Cinq différentes.** Option, activée par défaut ; l’hôte peut la désactiver avant la partie.",
        "le joueur suivant doit jouer 4 tours",
        "4 exemplaires",
        "Il n’y a pas de points",
        "Il n’y a jamais d’égalité",
      ],
      en: [
        "It lasts 5 seconds by default; the host can pick 3, 5 or 8 seconds before the game.",
        "**Five different.** An option, on by default; the host can turn it off before the game.",
        "the next player takes 4 turns",
        "4 copies of each",
        "There are no points",
        "There are never any ties",
      ],
      es: [
        "Dura 5 segundos por defecto; el anfitrión puede elegir 3, 5 u 8 segundos antes de la partida.",
        "**Cinco distintas.** Es una opción, activada por defecto; el anfitrión puede desactivarla antes de la partida.",
        "debe jugar 4 turnos",
        "4 copias de cada una",
        "No hay puntos",
        "Nunca hay empates",
      ],
      de: [
        "Standardmäßig dauert es 5 Sekunden; der Gastgeber kann vor dem Spiel 3, 5 oder 8 Sekunden wählen.",
        "**Fünfling.** Eine Option, standardmäßig an; der Gastgeber kann sie vor dem Spiel ausschalten.",
        "muss die nächste Person 4 Züge spielen",
        "jeweils 4 Exemplare",
        "Punkte gibt es nicht",
        "Gleichstände gibt es nie",
      ],
    }

    it.each(LANGUAGE_IDS)("state the deal of the Original Edition in %s", (language) => {
      const setup = sectionOf("setup").body[language] as string
      expect(setup).toContain(DEAL[language])
      for (const phrase of SETUP[language]) expect(setup, phrase).toContain(phrase)
    })

    it.each(LANGUAGE_IDS)("keep the wording of the options, the stacked attacks and the end of the game in %s", (language) => {
      for (const phrase of WORDING[language]) expect(wholeRules(language), phrase).toContain(phrase)
    })

    it("leave out what is not decided: the faster game and the classic deal", () => {
      expect(wholeRules("fr")).not.toMatch(/partie rapide|distribution classique/i)
      expect(wholeRules("en")).not.toMatch(/faster game|classic/i)
      expect(wholeRules("es")).not.toMatch(/partida rápida|reparto clásico/i)
      expect(wholeRules("de")).not.toMatch(/schnelles spiel|klassische/i)
    })

    it("make no claim about counting cards", () => {
      expect(wholeRules("fr")).not.toMatch(/compter les cartes|bonne guerre|fair-?play/i)
      expect(wholeRules("en")).not.toMatch(/counting cards|fair play/i)
      expect(wholeRules("es")).not.toMatch(/contar (las )?cartas|juego limpio/i)
      expect(wholeRules("de")).not.toMatch(/Karten (mit)?zählen|Fairplay|Fair Play/i)
    })
  })

  describe("and the other documents", () => {
    const names = (key: CardTypeKey, language: LanguageId): string => (buildCardTypes() as Doc[]).find((doc) => doc.key === key)?.name[language]

    it("calls the six action cards by the names of their card types, in every language", () => {
      const sixKeys = CARD_TYPE_KEYS.slice(2, 8)
      expect(sixKeys).toEqual(["attack", "skip", "favor", "shuffle", "see-the-future", "nope"])
      for (const language of LANGUAGE_IDS) {
        const labels = paragraphsOf(sectionOf("cards").body[language]).slice(1, 7).map(labelOf)
        expect(labels, language).toEqual(sixKeys.map((key) => names(key, language)))
      }
    })

    it("names the five cats as their card types do", () => {
      for (const language of LANGUAGE_IDS) {
        const cats = paragraphsOf(sectionOf("cards").body[language]).at(-1) as string
        for (const key of CATS) expect(cats, `${key} ${language}`).toContain(names(key, language))
      }
    })

    it.each([
      ["fr", ["Deux pareilles", "Trois pareilles", "Cinq différentes"]],
      ["en", ["Pair", "Three of a kind", "Five different"]],
      ["es", ["Pareja", "Trío", "Cinco distintas"]],
      ["de", ["Pärchen", "Drilling", "Fünfling"]],
    ] as const)("calls the three combinations by the glossary in %s", (language, labels) => {
      expect(paragraphsOf(sectionOf("combos").body[language]).slice(1).map(labelOf)).toEqual(labels)
    })
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
    // 13 card types (name, effect), the edition name, the introduction of the rules, 10 sections (title, body), the credits
    expect(objects).toHaveLength(49)
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
    expect(PROJECT_ID).toBe("gsfz20b9")
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
