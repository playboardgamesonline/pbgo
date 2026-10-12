import { existsSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { describe, expect, it } from "vitest"
import { BONUS_TILE_NUMBERS, DIRECTION_KEYS, EXTENSION_KEYS, PATTERN_KEYS, RANKS, RATING_KEYS, SUIT_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import { CONTENT_DIR, DATASET, ENV_FILE, GAME_DIR, PROJECT_ID, REPO_ROOT, SLUG } from "../config.ts"
import { LANGUAGE_IDS } from "../lib/locale.ts"
import type { LanguageId } from "../lib/locale.ts"
import { assertSeedId } from "../lib/plan.ts"
import { ART_SLOTS } from "./art-manifest.ts"
import { bonusTileId, buildBonusTiles, TILE_SPECS } from "./bonus-tiles.ts"
import { buildCards, cardId, quantityOf } from "./cards.ts"
import { buildGame, GAME_ID, ratingItemKey, ratingScale, valueGlyphKey } from "./game.ts"
import { buildRules, RULES_ID, RULES_SECTION_KEYS } from "./rules.ts"
import { buildSettings, RULES_PDF, SETTINGS_ID } from "./settings.ts"
import { buildSuits, directionOf, extensionOf, suitId } from "./suits.ts"
import { imagesOf, imageValue, seedDocs } from "./test-fixtures.ts"
import type { Doc } from "./test-fixtures.ts"

type LocaleObject = { _type: "localeString" | "localeText" } & Record<LanguageId, string>
// The tests read documents of every shape without a type for each of them
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = { _key: string; _type: string } & Record<string, any>

const docs = seedDocs
const sorted = (numbers: number[]) => [...numbers].sort((a, b) => a - b)
const digitsOf = (text: string) => sorted((text.match(/\d+/g) ?? []).map(Number))
const paragraphsOf = (text: string) => text.split("\n\n")

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
const allTexts = () => allLocaleObjects().flatMap(({ path, value }) => LANGUAGE_IDS.map((language) => ({ where: `${path}.${language}`, language, kind: value._type, text: value[language] })))

const rulesDoc = () => buildRules() as Doc
const sectionOf = (key: string) => (rulesDoc().sections as Item[]).find((section) => section._key === key) as Item
const wholeRules = (language: LanguageId) => [rulesDoc().intro[language], ...(rulesDoc().sections as Item[]).map((section) => section.body[language])].join("\n\n")

const ASCENDING = { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1 }

describe("the seed documents", () => {
  it("are 51: 7 suits, 35 cards, 6 bonus tiles, and the game, rules and settings singletons", () => {
    const all = docs()
    expect(all).toHaveLength(51)
    const count = (type: string) => all.filter((doc) => doc._type === type).length
    expect({ suit: count("suit"), card: count("card"), bonusTile: count("bonusTile"), game: count("game"), rules: count("rules"), settings: count("settings") }).toEqual({
      suit: 7,
      card: 35,
      bonusTile: 6,
      game: 1,
      rules: 1,
      settings: 1,
    })
  })

  it("have unique ids", () => {
    const ids = docs().map((doc) => doc._id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("have plain published ids: the writer adds the draft prefix, nothing here is a draft or a version", () => {
    for (const { _id } of docs()) {
      expect(() => assertSeedId(_id), _id).not.toThrow()
      expect(_id.startsWith("drafts.") || _id.startsWith("versions.")).toBe(false)
    }
  })

  it("keep the three singletons under the name of their type, which is how the Studio addresses them", () => {
    expect({ [GAME_ID]: "game", [RULES_ID]: "rules", [SETTINGS_ID]: "settings" }).toEqual({ game: "game", rules: "rules", settings: "settings" })
    for (const type of ["game", "rules", "settings"]) expect(docs().find((doc) => doc._type === type)?._id).toBe(type)
  })

  it("carry nothing but content: no revision, no date, no image reference", () => {
    for (const doc of docs()) {
      for (const field of ["_rev", "_createdAt", "_updatedAt"]) expect(doc, `${doc._id} ${field}`).not.toHaveProperty(field)
      expect(imagesOf(doc), doc._id).toEqual([])
    }
  })

  it("are plain JSON: nothing is lost on its way to the API", () => {
    const all = docs()
    expect(JSON.parse(JSON.stringify(all))).toStrictEqual(all)
  })

  it("are built afresh each time, so that placing an image in one run cannot leak into the next", () => {
    const first = docs()
    const second = docs()
    expect(second).toStrictEqual(first)
    const game = first.find((doc) => doc._type === "game") as Doc
    ;(game.scoreScale as Item[])[0]!.label.fr = "changed"
    game.extra = true
    expect((second.find((doc) => doc._type === "game") as Doc).scoreScale[0].label.fr).toBe("Risible")
    expect(second.find((doc) => doc._type === "game")).not.toHaveProperty("extra")
    expect(docs().find((doc) => doc._type === "game")).not.toHaveProperty("extra")
  })

  it("give every array item a stable key and a type, unique in its array", () => {
    for (const doc of docs()) {
      for (const [field, value] of Object.entries(doc)) {
        if (!Array.isArray(value)) continue
        const keys = (value as Item[]).map((item) => item._key)
        expect(keys.every((key) => typeof key === "string" && key.length > 0), `${doc._id}.${field} keys`).toBe(true)
        expect(new Set(keys).size, `${doc._id}.${field} unique keys`).toBe(keys.length)
        expect((value as Item[]).every((item) => typeof item._type === "string"), `${doc._id}.${field} types`).toBe(true)
      }
    }
  })
})

describe("the suits", () => {
  const suits = () => buildSuits() as Doc[]

  it("are the seven of the schema, in its order", () => {
    expect(suits().map((suit) => suit.key)).toEqual([...SUIT_KEYS])
    expect(suits().map((suit) => suit._id)).toEqual(SUIT_KEYS.map(suitId))
    expect(SUIT_KEYS.map(suitId)).toEqual(["suit-white", "suit-red", "suit-blue", "suit-yellow", "suit-green", "suit-multi", "suit-black"])
  })

  it("are five basic colors, the multicolor one of Avalanche and the black one of Black Powder", () => {
    const by = (key: string) => suits().find((suit) => suit.key === key) as Doc
    for (const key of ["white", "red", "blue", "yellow", "green"]) expect([by(key).extension, by(key).direction]).toEqual(["base", "ascending"])
    expect([by("multi").extension, by("multi").direction]).toEqual(["avalanche", "ascending"])
    expect([by("black").extension, by("black").direction]).toEqual(["blackPowder", "descending"])
    expect(suits().filter((suit) => suit.extension === "base")).toHaveLength(5)
  })

  it("only use the extensions, directions and patterns the schema lists", () => {
    for (const suit of suits()) {
      expect(EXTENSION_KEYS).toContain(suit.extension)
      expect(DIRECTION_KEYS).toContain(suit.direction)
      expect(PATTERN_KEYS).toContain(suit.pattern)
    }
  })

  it("can be told apart without color: own symbol, own letter, own pattern", () => {
    const distinct = (field: string) => new Set(suits().map((suit) => suit[field])).size
    expect(distinct("color")).toBe(7)
    expect(distinct("symbol")).toBe(7)
    expect(distinct("letter")).toBe(7)
    expect(distinct("pattern")).toBe(7)
  })

  it("write the color as a six digit hex value and the letter as one capital", () => {
    for (const suit of suits()) {
      expect(suit.color, suit.key).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(suit.letter, suit.key).toMatch(/^[A-Z]$/)
    }
  })

  it("keep the no-pattern value for the white suit only", () => {
    expect(suits().filter((suit) => suit.pattern === "none").map((suit) => suit.key)).toEqual(["white"])
  })

  it("have a name in each language, different from one suit to the next", () => {
    for (const language of LANGUAGE_IDS) {
      const names = suits().map((suit) => suit.name[language])
      expect(new Set(names).size, language).toBe(7)
    }
  })

  it("answer directionOf and extensionOf as their document says", () => {
    for (const suit of suits()) {
      expect(directionOf(suit.key)).toBe(suit.direction)
      expect(extensionOf(suit.key)).toBe(suit.extension)
    }
  })
})

describe("the cards", () => {
  const cards = () => buildCards() as Doc[]
  const copies = (suit: string) => cards().filter((card) => card.suit === suit).reduce((total, card) => total + card.quantity, 0)

  it("are one document per suit and value: 7 × 5", () => {
    expect(cards().map((card) => [card.suit, card.rank])).toEqual(SUIT_KEYS.flatMap((suit) => RANKS.map((rank) => [suit, rank])))
    expect(cards().map((card) => card._id)).toEqual(SUIT_KEYS.flatMap((suit) => RANKS.map((rank) => cardId(suit, rank))))
    expect(cardId("red", 3)).toBe("card-red-3")
  })

  it("count three 1s, two 2s, 3s and 4s and one 5 in a firework built upwards", () => {
    for (const suit of SUIT_KEYS.filter((key) => directionOf(key) === "ascending")) {
      expect(Object.fromEntries(cards().filter((card) => card.suit === suit).map((card) => [card.rank, card.quantity])), suit).toEqual(ASCENDING)
    }
  })

  it("count the black firework the other way round: the 5 is the common card and the 1 the scarce one", () => {
    expect(Object.fromEntries(cards().filter((card) => card.suit === "black").map((card) => [card.rank, card.quantity]))).toEqual({ 1: 1, 2: 2, 3: 2, 4: 2, 5: 3 })
    for (const rank of RANKS) expect(quantityOf("black", rank)).toBe(ASCENDING[(6 - rank) as 1 | 2 | 3 | 4 | 5])
  })

  it("make ten cards a suit", () => {
    for (const suit of SUIT_KEYS) expect(copies(suit), suit).toBe(10)
  })

  it("make the decks of the rulebook: 50 cards, 60 with either extension, 70 with both", () => {
    const base = ["white", "red", "blue", "yellow", "green"].reduce((total, suit) => total + copies(suit), 0)
    expect(base).toBe(50)
    expect(base + copies("multi")).toBe(60)
    expect(base + copies("black")).toBe(60)
    expect(base + copies("multi") + copies("black")).toBe(70)
    expect(cards().reduce((total, card) => total + card.quantity, 0)).toBe(70)
  })

  it("have whole quantities, at least one", () => {
    for (const card of cards()) expect(Number.isInteger(card.quantity) && card.quantity >= 1, card._id).toBe(true)
  })

  it("answer quantityOf as their document says", () => {
    for (const card of cards()) expect(quantityOf(card.suit, card.rank)).toBe(card.quantity)
  })
})

describe("the bonus tiles", () => {
  const tiles = () => buildBonusTiles() as Doc[]

  it("are the six of the 5 Flamboyants extension, numbered from 1", () => {
    expect(tiles().map((tile) => tile.number)).toEqual([...BONUS_TILE_NUMBERS])
    expect(tiles().map((tile) => tile._id)).toEqual(BONUS_TILE_NUMBERS.map(bonusTileId))
    expect(BONUS_TILE_NUMBERS).toEqual([1, 2, 3, 4, 5, 6])
    expect(Object.keys(TILE_SPECS).map(Number)).toEqual([...BONUS_TILE_NUMBERS])
  })

  it("have a name and an effect in each language", () => {
    for (const tile of tiles()) {
      expect(tile.name._type).toBe("localeString")
      expect(tile.effect._type).toBe("localeText")
      for (const language of LANGUAGE_IDS) {
        expect(tile.name[language].length, `${tile._id} name ${language}`).toBeGreaterThan(2)
        expect(tile.effect[language].length, `${tile._id} effect ${language}`).toBeGreaterThan(30)
      }
    }
  })

  it("differ from one another", () => {
    for (const language of LANGUAGE_IDS) {
      expect(new Set(tiles().map((tile) => tile.name[language])).size, `names ${language}`).toBe(6)
      expect(new Set(tiles().map((tile) => tile.effect[language])).size, `effects ${language}`).toBe(6)
    }
  })

  it("keep an effect on one line of text per paragraph, with no list marker of its own", () => {
    for (const tile of tiles()) for (const language of LANGUAGE_IDS) expect(tile.effect[language], `${tile._id} ${language}`).not.toMatch(/^\s*[-*•]/m)
  })
})

describe("the game", () => {
  const game = () => buildGame() as Doc

  it("is the singleton, without any image: the art step brings the mat, the tokens, the glyphs and the badges", () => {
    expect(game()._id).toBe("game")
    expect(game()._type).toBe("game")
    expect(Object.keys(game()).sort()).toEqual(["_id", "_type", "scoreScale", "valueGlyphs"])
  })

  it("lists one glyph per value, keyed so that the art can find it", () => {
    expect((game().valueGlyphs as Item[]).map((glyph) => [glyph._key, glyph._type, glyph.rank])).toEqual(RANKS.map((rank) => [valueGlyphKey(rank), "valueGlyph", rank]))
    expect(valueGlyphKey(3)).toBe("v3")
  })

  it("lists the seven ratings, from the lowest score to the highest", () => {
    const scale = game().scoreScale as Item[]
    expect(scale.map((rating) => rating.key)).toEqual([...RATING_KEYS])
    expect(scale.map((rating) => rating._key)).toEqual(RATING_KEYS.map(ratingItemKey))
    expect(scale.map((rating) => rating._type)).toEqual(RATING_KEYS.map(() => "rating"))
    expect(scale.map((rating) => rating.minScore)).toEqual([0, 6, 11, 16, 21, 25, 30])
  })

  it("gives each rating a label and a line in each language", () => {
    for (const rating of game().scoreScale as Item[]) {
      expect(rating.label._type).toBe("localeString")
      expect(rating.line._type).toBe("localeString")
      for (const language of LANGUAGE_IDS) {
        expect(rating.label[language].length, `${rating.key} label ${language}`).toBeGreaterThan(3)
        expect(rating.line[language].length, `${rating.key} line ${language}`).toBeGreaterThan(15)
      }
    }
  })

  it("covers every score from 0 to 30 once, with 30 the top: six suits of five", () => {
    const steps = ratingScale()
    expect(steps[0]?.from).toBe(0)
    expect(steps.at(-1)).toMatchObject({ from: 30, to: 30 })
    steps.forEach((step, index) => {
      expect(step.to).toBeGreaterThanOrEqual(step.from)
      if (index > 0) expect(step.from).toBe((steps[index - 1] as (typeof steps)[number]).to + 1)
    })
    expect(steps.map((step) => [step.from, step.to])).toEqual([[0, 5], [6, 10], [11, 15], [16, 20], [21, 24], [25, 29], [30, 30]])
  })

  it("agrees with the scale that ratingScale derives", () => {
    const scale = game().scoreScale as Item[]
    ratingScale().forEach((step, index) => {
      expect(scale[index]?.key).toBe(step.key)
      expect(scale[index]?.minScore).toBe(step.from)
      expect(scale[index]?.label).toEqual(step.label ? expect.objectContaining(step.label) : undefined)
    })
  })
})

describe("the rules", () => {
  it("are the shared rules document, with an introduction and 13 sections in a fixed order", () => {
    const rules = rulesDoc()
    expect(rules._id).toBe("rules")
    expect(rules._type).toBe("rules")
    expect(Object.keys(rules).sort()).toEqual(["_id", "_type", "intro", "sections"])
    expect(rules.intro._type).toBe("localeText")
    expect((rules.sections as Item[]).map((section) => section._key)).toEqual([
      "goal",
      "setup",
      "turn",
      "clue",
      "discard",
      "play",
      "end",
      "score",
      "avalanche",
      "blackPowder",
      "flamboyants",
      "bouquetFinal",
      "online",
    ])
    expect(RULES_SECTION_KEYS).toEqual((rules.sections as Item[]).map((section) => section._key))
  })

  it("give every section a title on one line and a body, in each language", () => {
    for (const section of rulesDoc().sections as Item[]) {
      expect(section._type).toBe("section")
      expect(section.title._type).toBe("localeString")
      expect(section.body._type).toBe("localeText")
      for (const language of LANGUAGE_IDS) {
        expect(section.title[language].length, `${section._key} title ${language}`).toBeGreaterThan(2)
        expect(section.body[language].length, `${section._key} body ${language}`).toBeGreaterThan(40)
      }
    }
  })

  describe("in the four languages", () => {
    const keys = ["intro", ...RULES_SECTION_KEYS]
    const textOf = (key: string, language: LanguageId): string => (key === "intro" ? rulesDoc().intro[language] : sectionOf(key).body[language])

    it.each(keys)("%s has the same number of paragraphs", (key) => {
      const expected = paragraphsOf(textOf(key, "fr")).length
      for (const language of LANGUAGE_IDS) expect(paragraphsOf(textOf(key, language)), `${key} ${language}`).toHaveLength(expected)
    })

    it.each(keys)("%s has the same number of bold marks", (key) => {
      const marks = (language: LanguageId) => (textOf(key, language).match(/\*\*/g) ?? []).length
      expect(marks("fr") % 2).toBe(0)
      for (const language of LANGUAGE_IDS) expect(marks(language), `${key} ${language}`).toBe(marks("fr"))
    })

    // The first paragraph of "flamboyants" says the name of the extension: it is French, so English, Spanish and German add a gloss, which has a figure of its own in German (“flamboyanten 5er”).
    const NAMES_THE_EXTENSION: Record<string, number> = { flamboyants: 0 }

    it.each(keys)("%s gives the same figures in each paragraph", (key) => {
      const paragraphs = (language: LanguageId) => paragraphsOf(textOf(key, language))
      paragraphs("fr").forEach((paragraph, index) => {
        if (NAMES_THE_EXTENSION[key] === index) return
        for (const language of LANGUAGE_IDS) expect(digitsOf(paragraphs(language)[index] as string), `${key} ¶${index + 1} ${language}`).toEqual(digitsOf(paragraph))
      })
    })

    it("glosses the extension name once, in the first paragraph of its section, for the three languages that do not read French", () => {
      const first = (language: LanguageId) => paragraphsOf(sectionOf("flamboyants").body[language])[0] as string
      expect(first("fr")).not.toContain("5 Flamboyants")
      for (const language of ["en", "es", "de"] as const) expect(first(language), language).toContain("5 Flamboyants")
    })

    it.each(LANGUAGE_IDS)("keeps the French name 5 Flamboyants in %s", (language) => {
      expect(wholeRules(language)).toContain("5 Flamboyants")
    })

    it.each([
      ["fr", ["jeton Indice", "tuile Erreur", "tuile Bonus"]],
      ["en", ["clue token", "fuse token", "bonus tile"]],
      ["es", ["ficha de pista", "ficha de error", "loseta de bonificación"]],
      ["de", ["Hinweisplättchen", "Fehlerplättchen", "Bonusplättchen"]],
    ] as const)("uses the vocabulary of the glossary in %s", (language, terms) => {
      for (const term of terms) expect(wholeRules(language), term).toContain(term)
    })

    it("pins the hard numbers of the base game", () => {
      expect(digitsOf(paragraphsOf(sectionOf("setup").body.fr).join(" "))).toEqual(sorted([10, 1, 2, 3, 4, 5, 50, 10, 60, 70, 8, 3, 5, 2, 3, 4, 4, 5]))
      expect(sectionOf("setup").body.fr).toContain("8 jetons Indice")
      expect(sectionOf("setup").body.fr).toContain("3 tuiles Erreur")
      expect(sectionOf("setup").body.fr).toContain("5 cartes à 2 ou 3 joueurs, 4 cartes à 4 ou 5 joueurs")
      expect(sectionOf("goal").body.fr).toContain("25 points")
      expect(sectionOf("end").body.fr).toContain("0 point")
    })

    it("pins the tokens and the hands in each language, not only in French", () => {
      expect(sectionOf("setup").body.en).toContain("8 clue tokens")
      expect(sectionOf("setup").body.en).toContain("3 fuse tokens")
      expect(sectionOf("setup").body.es).toContain("8 fichas de pista")
      expect(sectionOf("setup").body.es).toContain("3 fichas de error")
      expect(sectionOf("setup").body.de).toContain("8 Hinweisplättchen")
      expect(sectionOf("setup").body.de).toContain("3 Fehlerplättchen")
    })
  })

  describe("and the other documents", () => {
    it("write the score scale of the game document into the score section", () => {
      const scale = (language: LanguageId) => ratingScale().map(({ from, to, label }) => `**${from === to ? from : `${from}–${to}`}** ${label[language]}`).join(" · ")
      for (const language of LANGUAGE_IDS) expect(sectionOf("score").body[language], language).toContain(scale(language))
      expect(sectionOf("score").body.fr).toContain("**0–5** Risible · **6–10** Médiocre · **11–15** Honorable · **16–20** Excellente · **21–24** Extraordinaire · **25–29** Légendaire · **30** Divine")
      expect(sectionOf("score").body.en).toContain("**0–5** Laughable · **6–10** Mediocre")
    })

    it("write the six bonus tiles of the bonus tile documents into the 5 Flamboyants section", () => {
      for (const language of LANGUAGE_IDS) {
        for (const tile of buildBonusTiles() as Doc[]) {
          expect(sectionOf("flamboyants").body[language], `${tile._id} ${language}`).toContain(`**${tile.number}. ${tile.name[language]}.** ${tile.effect[language]}`)
        }
      }
    })
  })
})

describe("the settings", () => {
  const settings = () => buildSettings() as Doc

  it("hold the credits and the rulebook links, and leave the rest of the document to the Studio", () => {
    expect(Object.keys(settings()).sort()).toEqual(["_id", "_type", "creditsAuthors", "creditsAuthorsI18n", "publisher", "publisherUrl", "rulesPdfEn", "rulesPdfFr"])
    expect(settings()._id).toBe("settings")
    expect(settings()._type).toBe("settings")
  })

  it("credit the author in every language, the French footer falling back to the plain field", () => {
    expect(settings().creditsAuthors).toBe("Antoine Bauza")
    expect(settings().creditsAuthorsI18n._type).toBe("localeString")
    for (const language of LANGUAGE_IDS) expect(settings().creditsAuthorsI18n[language]).toBe("Antoine Bauza")
  })

  it("link the publisher", () => {
    expect(settings().publisher).toBe("Cocktail Games")
    const url = new URL(settings().publisherUrl)
    expect(url.protocol).toBe("https:")
    expect(url.hostname).toBe("www.cocktailgames.com")
  })

  it("link the French and English rulebooks, and no other language", () => {
    expect(settings().rulesPdfFr).toBe(RULES_PDF.fr)
    expect(settings().rulesPdfEn).toBe(RULES_PDF.en)
    expect(Object.keys(RULES_PDF).sort()).toEqual(["en", "fr"])
    expect(settings()).not.toHaveProperty("rulesPdfEs")
    expect(settings()).not.toHaveProperty("rulesPdfDe")
    for (const link of [settings().rulesPdfFr, settings().rulesPdfEn]) {
      const url = new URL(link)
      expect(url.protocol).toBe("https:")
      expect(url.pathname.toLowerCase()).toMatch(/\.pdf$/)
    }
  })

  it("do not hold the rulebook text, only its address", () => {
    for (const value of Object.values(settings())) expect(typeof value === "string" ? value.length : 0).toBeLessThan(200)
  })
})

describe("every text", () => {
  it("is in the four languages, for every localeString and localeText of every document", () => {
    const objects = allLocaleObjects()
    expect(objects.length).toBeGreaterThan(50)
    for (const { path, value } of objects) {
      expect(Object.keys(value).sort(), path).toEqual(["_type", ...LANGUAGE_IDS].sort())
    }
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
      expect(text, where).not.toMatch(/\b(todo|tbd|fixme|lorem|ipsum|placeholder|xxx)\b/i)
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
  it("points at the Hanabi project of the registry, the single source of project ids", async () => {
    // Loaded by its path, as scripts/lib.sh does: a static import would pull all of @pbgo/core into the typecheck of this folder
    const { GAMES } = (await import(/* @vite-ignore */ join(REPO_ROOT, "packages/games/src/registry.ts"))) as { GAMES: { slug: string; sanityProjectId: string }[] }
    const entries = GAMES.filter((game) => game.slug === SLUG)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.sanityProjectId).toBe(PROJECT_ID)
    expect(PROJECT_ID).toBe("srffdhjt")
  })

  it("points at the same project as the studio", () => {
    for (const file of ["sanity.config.ts", "sanity.cli.ts"]) expect(readFileSync(join(GAME_DIR, "apps/studio", file), "utf8"), file).toContain(PROJECT_ID)
  })

  it("writes to the production dataset of the game it lives in", () => {
    expect(DATASET).toBe("production")
    expect(SLUG).toBe("hanabi")
    expect(basename(GAME_DIR)).toBe(SLUG)
    expect(basename(CONTENT_DIR)).toBe("content")
  })

  it("finds the repository root, and the env file where the web app keeps it", () => {
    expect(existsSync(join(REPO_ROOT, "pnpm-workspace.yaml"))).toBe(true)
    expect(ENV_FILE).toBe(join(REPO_ROOT, "apps/web/.env.local"))
  })
})

describe("the art slots", () => {
  const family = (slot: { name: string }) => slot.name.replace(/-.*/, "")
  const counts = () => {
    const result: Record<string, number> = {}
    for (const slot of ART_SLOTS) result[family(slot)] = (result[family(slot)] ?? 0) + 1
    return result
  }
  const image = imageValue

  it("are 66: 7 suit symbols, 35 card faces, 6 game images, 5 value glyphs, 7 rating badges, 6 bonus tile icons", () => {
    expect(ART_SLOTS).toHaveLength(66)
    // the game slots (card back, mat and the tokens) share the first word with the card faces: "card-back" is a "card"
    expect(counts()).toEqual({ suit: 7, card: 36, mat: 1, clue: 2, fuse: 2, value: 5, rating: 7, bonus: 6 })
  })

  it("are named after what they hold, in lower case with dashes", () => {
    for (const slot of ART_SLOTS) {
      for (const name of [slot.name, ...(slot.aliases ?? [])]) expect(name, name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
    expect(ART_SLOTS.map((slot) => slot.name)).toContain("card-red-3")
    expect(ART_SLOTS.map((slot) => slot.name)).toContain("card-back")
    expect(ART_SLOTS.map((slot) => slot.name)).toContain("rating-legendary")
  })

  it("never share a name, aliases included: a file would fill two slots", () => {
    const names = ART_SLOTS.flatMap((slot) => [slot.name, ...(slot.aliases ?? [])])
    expect(new Set(names).size).toBe(names.length)
  })

  it("accept rainbow for the multicolor suit, and nothing else under another name", () => {
    const aliased = ART_SLOTS.filter((slot) => slot.aliases?.length)
    expect(aliased.map((slot) => slot.name)).toEqual(["suit-multi", ...RANKS.map((rank) => `card-multi-${rank}`)])
    expect(aliased.flatMap((slot) => slot.aliases)).toEqual(["suit-rainbow", ...RANKS.map((rank) => `card-rainbow-${rank}`)])
  })

  it("have a label and a size limit", () => {
    for (const slot of ART_SLOTS) {
      expect(slot.label.length, slot.name).toBeGreaterThan(5)
      expect(slot.maxSize, slot.name).toBeGreaterThanOrEqual(256)
      expect(slot.maxSize, slot.name).toBeLessThanOrEqual(2400)
    }
    expect(new Set(ART_SLOTS.map((slot) => slot.label)).size).toBe(ART_SLOTS.length)
  })

  it("expect a card face in the proportions of the printed cards, and a square symbol", () => {
    for (const slot of ART_SLOTS) {
      if (slot.name === "card-back" || /^card-(white|red|blue|yellow|green|multi|black)-\d$/.test(slot.name)) expect(slot.ratio, slot.name).toEqual([5, 7])
      else if (slot.name.startsWith("suit-")) expect(slot.ratio, slot.name).toEqual([1, 1])
      else expect(slot.ratio, slot.name).toBeUndefined()
    }
  })

  it("belong to a document of the seed", () => {
    const ids = new Set(docs().map((doc) => doc._id))
    for (const slot of ART_SLOTS) expect(ids.has(slot.docId), `${slot.name} → ${slot.docId}`).toBe(true)
  })

  it("put the image in one field of its document, and change nothing else", () => {
    for (const slot of ART_SLOTS) {
      const all = docs()
      const doc = all.find((candidate) => candidate._id === slot.docId) as Doc
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

  it("put each family where the Studio schema keeps its image", () => {
    const where = (name: string) => {
      const slot = ART_SLOTS.find((candidate) => candidate.name === name)
      if (!slot) throw new Error(`no slot ${name}`)
      const doc = docs().find((candidate) => candidate._id === slot.docId) as Doc
      slot.place(doc, image(name))
      return `${doc._type}:${imagesOf(doc)[0]?.path}`
    }
    expect(where("suit-red")).toBe("suit:$.symbolImage")
    expect(where("card-red-3")).toBe("card:$.card")
    expect(where("card-black-1")).toBe("card:$.card")
    expect(where("card-back")).toBe("game:$.cardBack")
    expect(where("mat")).toBe("game:$.mat")
    expect(where("clue-token")).toBe("game:$.clueToken")
    expect(where("clue-token-spent")).toBe("game:$.clueTokenSpent")
    expect(where("fuse-token")).toBe("game:$.fuseToken")
    expect(where("fuse-token-exploded")).toBe("game:$.fuseTokenExploded")
    expect(where("value-4")).toBe("game:$.valueGlyphs[3].glyph")
    expect(where("rating-legendary")).toBe("game:$.scoreScale[5].badge")
    expect(where("bonus-2")).toBe("bonusTile:$.icon")
  })

  it("never aim two slots at the same field", () => {
    const targets = ART_SLOTS.map((slot) => {
      const doc = docs().find((candidate) => candidate._id === slot.docId) as Doc
      slot.place(doc, image(slot.name))
      return `${doc._id}${imagesOf(doc)[0]?.path}`
    })
    expect(new Set(targets).size).toBe(targets.length)
  })

  it("say which item is missing when a list has lost it", () => {
    const glyph = ART_SLOTS.find((slot) => slot.name === "value-1") as (typeof ART_SLOTS)[number]
    expect(() => glyph.place({ _id: "game", _type: "game", valueGlyphs: [] }, image("x"))).toThrow('"game" has no item "v1" in "valueGlyphs"')
    expect(() => glyph.place({ _id: "game", _type: "game" }, image("x"))).toThrow('"game" has no item "v1" in "valueGlyphs"')
    const badge = ART_SLOTS.find((slot) => slot.name === "rating-divine") as (typeof ART_SLOTS)[number]
    expect(() => badge.place({ _id: "game", _type: "game", scoreScale: [{ _key: "legendary" }] }, image("x"))).toThrow('"game" has no item "divine" in "scoreScale"')
  })
})
