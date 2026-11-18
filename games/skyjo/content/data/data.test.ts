import { readFileSync } from "node:fs"
import { join } from "node:path"
import { assertSeedId, LANGUAGE_IDS } from "@pbgo/content-kit"
import type { LanguageId } from "@pbgo/content-kit"
import type { Doc } from "@pbgo/content-kit/testing"
import { describe, expect, it } from "vitest"
import { CARD_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import { DATASET, PROJECT_ID, REPO_ROOT, SLUG } from "../config.ts"
import { ART_SLOTS } from "./art-manifest.ts"
import { CARD_LIST, buildCards, cardId } from "./cards.ts"
import { buildSeedDocs } from "./index.ts"
import { buildSettings } from "./settings.ts"
import { seedDocs } from "./test-fixtures.ts"
import { BOARD_WORDS, buildTexts, ENGINE_TEXTS, ERROR_MESSAGES } from "./texts.ts"

describe("the seed", () => {
  it("is the one of the game of the registry: its slug and its Sanity project", () => {
    const registry = readFileSync(join(REPO_ROOT, "packages/games/src/registry.ts"), "utf8")
    const entry = registry.slice(registry.indexOf(`slug: "${SLUG}"`))
    expect(entry.slice(0, entry.indexOf("\n  },"))).toContain(`sanityProjectId: "${PROJECT_ID}"`)
    expect(DATASET).toBe("production")
  })

  it("never marks the game live or indexable: that is the go-live stage", () => {
    const registry = readFileSync(join(REPO_ROOT, "packages/games/src/registry.ts"), "utf8")
    const entry = registry.slice(registry.indexOf(`slug: "${SLUG}"`))
    const own = entry.slice(0, entry.indexOf("\n  },"))
    expect(own).toMatch(/live: false/)
    expect(own).toMatch(/indexable: false/)
  })

  it("writes the 15 faces, the game, the settings and the texts, each with an id of its own", () => {
    const docs = buildSeedDocs()
    expect(docs).toHaveLength(15 + 3)
    expect(new Set(docs.map((doc) => doc._id)).size).toBe(docs.length)
    for (const doc of docs) assertSeedId(doc._id)
    expect(docs.map((doc) => doc._type).sort()).toEqual([...Array(15).fill("card"), "game", "settings", "texts"].sort())
  })

  it("gives fresh objects on every build, so a run that completes them changes nothing for the next", () => {
    const first = buildSeedDocs()
    ;(first[0] as unknown as { quantity: number }).quantity = 99
    expect(buildSeedDocs()[0]).not.toBe(first[0])
    expect((buildSeedDocs()[0] as unknown as { quantity: number }).quantity).toBe(5)
  })

  it("never publishes: every id is a plain id the runner turns into a draft", () => {
    for (const doc of seedDocs()) expect(doc._id.startsWith("drafts.")).toBe(false)
  })
})

describe("the cards", () => {
  const cards = buildCards()

  it("are the 15 faces, in the order of the values, each under the id of the engine's key", () => {
    expect(CARD_LIST.map((card) => card.key)).toEqual([...CARD_KEYS])
    expect(cards.map((card) => card._id)).toEqual(CARD_KEYS.map((key) => `card-${key}`))
    expect(cardId("minus-2")).toBe("card-minus-2")
    expect(cards.map((card) => card.order)).toEqual(Array.from({ length: 15 }, (_, i) => i))
  })

  it("make the 150 cards of the box: five -2, ten -1, fifteen 0 and ten of each from 1 to 12", () => {
    const quantity = Object.fromEntries(cards.map((card) => [card.key as string, card.quantity as number]))
    expect(quantity).toEqual({ "minus-2": 5, "minus-1": 10, "0": 15, ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 10])) })
    expect(cards.reduce((sum, card) => sum + (card.quantity as number), 0)).toBe(150)
  })

  it("file each face in its colour band: dark blue -2 and -1, light blue 0, green 1 to 4, yellow 5 to 8, red 9 to 12", () => {
    const band = (key: string) => cards.find((card) => card.key === key)?.band
    expect(["minus-2", "minus-1"].map(band)).toEqual(["dark-blue", "dark-blue"])
    expect(band("0")).toBe("light-blue")
    expect(["1", "2", "3", "4"].map(band)).toEqual(Array(4).fill("green"))
    expect(["5", "6", "7", "8"].map(band)).toEqual(Array(4).fill("yellow"))
    expect(["9", "10", "11", "12"].map(band)).toEqual(Array(4).fill("red"))
  })

  it("carry no text of their own: no name, no effect, no rule", () => {
    for (const card of cards) {
      expect(Object.keys(card).sort(), String(card._id)).toEqual(["_id", "_type", "band", "key", "order", "quantity"])
    }
  })
})

describe("the credits", () => {
  it("name the author and the publisher of the booklet, and no illustrator it does not name", () => {
    const settings = buildSettings()
    expect(settings.creditsAuthors).toBe("Alexander Bernhardt")
    expect(settings.publisher).toBe("Magilano")
    expect(settings).not.toHaveProperty("creditsIllustrators")
  })

  it("link to the publisher's website as the platform's catalog does: the booklets give no website, and magilano.eu only redirects to this one", () => {
    expect(buildSettings().publisherUrl).toBe("https://magilano.com/")
  })
})

describe("the settings the seed fills", () => {
  const settings = () => buildSettings() as Doc

  it("hold the description, the credits and the publisher, and nothing else", () => {
    expect(Object.keys(settings()).sort()).toEqual(["_id", "_type", "creditsAuthors", "creditsAuthorsI18n", "descriptionI18n", "publisher", "publisherUrl"])
  })

  it("describe the game in every language, in at least the 80 characters the Launch list asks for and at most the 400 the gamemaster keeps", () => {
    expect(settings().descriptionI18n._type).toBe("localeText")
    for (const language of LANGUAGE_IDS) {
      const text = settings().descriptionI18n[language] as string
      expect(text.length, language).toBeGreaterThanOrEqual(80)
      expect(text.length, language).toBeLessThanOrEqual(400)
    }
    // The localized description is read first and holds every language, so the single-language one (French, from before) stays empty
    expect(settings()).not.toHaveProperty("description")
  })
})

describe("the victory phrase", () => {
  const phrases = () => (buildTexts() as Doc).victoryPhrases as { _type: string } & Record<LanguageId, string[]>
  const every = (check: (phrase: string, where: string) => void) => {
    for (const language of LANGUAGE_IDS) for (const phrase of phrases()[language]) check(phrase, `${language}: ${phrase}`)
  }

  it("is a localeStringList: the four languages and nothing else", () => {
    expect(phrases()._type).toBe("localeStringList")
    expect(Object.keys(phrases()).sort()).toEqual(["_type", ...LANGUAGE_IDS].sort())
  })

  it("is one phrase in every language: the game over reads the same sentence", () => {
    for (const language of LANGUAGE_IDS) expect(phrases()[language], language).toHaveLength(1)
  })

  it("names the winner and their points once each, and holds no other braces", () => {
    every((phrase, where) => {
      expect(phrase.match(/\{pseudo\}/g), where).toHaveLength(1)
      expect(phrase.match(/\{points\}/g), where).toHaveLength(1)
      expect(phrase.replace(/\{(pseudo|points)\}/g, ""), where).not.toMatch(/[{}]/)
    })
  })

  it("leads to the name: the announcement shows what comes before it, so the sentence says the rule there", () => {
    every((phrase, where) => expect(phrase.split("{pseudo}")[0]!.trim().length, where).toBeGreaterThanOrEqual(20))
  })

  it("follows the typography of the other texts: trimmed, one line, one space at a time, the typographic apostrophe, no marker", () => {
    every((phrase, where) => {
      expect(phrase, where).toBe(phrase.trim())
      expect(phrase, where).not.toMatch(/ {2}|\t|[\r\n]/)
      expect(phrase, where).not.toContain("'")
      expect(phrase, where).not.toMatch(/\bTODO\b|\b(tbd|fixme|lorem|ipsum|placeholder|xxx)\b|\?\?|<\/?[a-z]|https?:\/\//i)
    })
  })

  it("stays inside what a screen of the game over can hold", () => {
    every((phrase, where) => expect(phrase.length, where).toBeLessThanOrEqual(120))
  })
})

describe("the art slots", () => {
  it("are the 15 faces, the back of the cards and the logo", () => {
    expect(ART_SLOTS.map((slot) => slot.name)).toEqual([...CARD_LIST.map((card) => card.engineKey), "card-back", "logo"])
  })

  it("answer to the names of the 16 images the owner handed over", () => {
    const names = ["skyjo-minus-2", "skyjo-minus-1", ...Array.from({ length: 13 }, (_, i) => `skyjo-${i}`), "skyjo-back"]
    expect(names).toHaveLength(16)
    for (const name of names) expect(ART_SLOTS.filter((slot) => slot.name === name || slot.aliases?.includes(name)), name).toHaveLength(1)
  })

  it("aim at documents of the seed", () => {
    const ids = new Set(seedDocs().map((doc) => doc._id))
    for (const slot of ART_SLOTS) expect(ids.has(slot.docId), slot.name).toBe(true)
  })
})

describe("the texts", () => {
  it("write the four languages of every word, with the same placeholders (the board-words test holds the rest)", () => {
    expect(BOARD_WORDS.length).toBeGreaterThan(30)
    expect(ENGINE_TEXTS).toHaveLength(5)
    expect(ERROR_MESSAGES.map((message) => message.code)).toEqual(["INVALID_POSITION", "CARD_FACE_UP", "MUST_PLACE"])
  })
})
