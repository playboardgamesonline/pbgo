import { readFileSync } from "node:fs"
import { join } from "node:path"
import { assertSeedId } from "@pbgo/content-kit"
import type { Doc } from "@pbgo/content-kit/testing"
import { describe, expect, it } from "vitest"
import { CHARACTER_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import { DATASET, PROJECT_ID, REPO_ROOT, SLUG } from "../config.ts"
import { ART_SLOTS } from "./art-manifest.ts"
import { CHARACTER_LIST, buildCharacters, characterId } from "./characters.ts"
import { buildSeedDocs } from "./index.ts"
import { buildSettings } from "./settings.ts"
import { seedDocs } from "./test-fixtures.ts"
import { buildTexts, ENGINE_TEXTS, ERROR_MESSAGES } from "./texts.ts"

/**
 * What a text may hold, from the owner's blank faces (see "Pictures" in this game's CLAUDE.md): the plate of four faces is shorter (the portrait runs lower) and holds three lines at the text size of the publisher's own sheet,
 * about 130 characters on the others; a name fits the banner at about twelve letters. A budget is a guard against an overflow, not a rule of the game: the board may fit a text smaller.
 */
const SHORT_PLATE = ["priest", "king", "countess", "princess"]
const BUDGET = { tall: 130, short: 90, name: 12 }

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

  it("writes the ten characters, the game, the settings and the texts, each with an id of its own", () => {
    const docs = buildSeedDocs()
    expect(docs).toHaveLength(10 + 3)
    expect(new Set(docs.map((doc) => doc._id)).size).toBe(docs.length)
    for (const doc of docs) assertSeedId(doc._id)
    expect(docs.map((doc) => doc._type).sort()).toEqual([...Array(10).fill("character"), "game", "settings", "texts"].sort())
  })

  it("gives fresh objects on every build, so a run that completes them changes nothing for the next", () => {
    const first = buildSeedDocs()
    ;(first[0] as unknown as { quantity: number }).quantity = 99
    expect(buildSeedDocs()[0]).not.toBe(first[0])
    expect((buildSeedDocs()[0] as unknown as { quantity: number }).quantity).toBe(2)
  })

  it("never publishes: every id is a plain id the runner turns into a draft", () => {
    for (const doc of seedDocs()) expect(doc._id.startsWith("drafts.")).toBe(false)
  })
})

describe("the characters", () => {
  const characters = seedDocs().filter((doc) => doc._type === "character")

  it("are the ten of the box, in the order of the values, each under the id of its key", () => {
    expect(CHARACTER_LIST.map((character) => character.key)).toEqual([...CHARACTER_KEYS])
    expect(characters.map((character) => character._id)).toEqual(CHARACTER_KEYS.map((key) => `character-${key}`))
    expect(characterId("spy")).toBe("character-spy")
    expect(characters.map((character) => character.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(buildCharacters()).toHaveLength(10)
  })

  it("make the 21 cards of the box: two Spies, six Guards, two each of the Priest, the Baron, the Handmaid, the Prince and the Chancellor, one each of the King, the Countess and the Princess", () => {
    const quantity = Object.fromEntries(characters.map((character) => [character.key as string, character.quantity as number]))
    expect(quantity).toEqual({ spy: 2, guard: 6, priest: 2, baron: 2, handmaid: 2, prince: 2, chancellor: 2, king: 1, countess: 1, princess: 1 })
    expect(characters.reduce((sum, character) => sum + (character.quantity as number), 0)).toBe(21)
  })

  it("carry no effect and no rule: what a card does is the engine's, and the only texts are its name and the card text to display", () => {
    for (const character of characters) {
      expect(Object.keys(character).sort(), String(character._id)).toEqual(["_id", "_type", "key", "name", "quantity", "text", "value"])
    }
  })

  it("are named as the 2025 rulebook names them in English and as the publisher's French demo leaflet names them in French", () => {
    expect(characters.map((character) => character.name.en)).toEqual(["Spy", "Guard", "Priest", "Baron", "Handmaid", "Prince", "Chancellor", "King", "Countess", "Princess"])
    expect(characters.map((character) => character.name.fr)).toEqual(["Espionne", "Garde", "Prêtre", "Baron", "Servante", "Prince", "Chancelier", "Roi", "Comtesse", "Princesse"])
  })

  it("leave Spanish and German empty: nothing is translated that has no source, and the Studio shows the gap", () => {
    for (const character of characters) {
      expect(Object.keys(character.name).sort(), `${character._id} name`).toEqual(["_type", "en", "fr"])
      expect(Object.keys(character.text).sort(), `${character._id} text`).toEqual(["_type", "en", "fr"])
    }
  })
})

describe("the card texts", () => {
  const characters = seedDocs().filter((doc) => doc._type === "character")
  const texts = characters.flatMap((character: Doc) => (["en", "fr"] as const).map((language) => ({ id: `${character._id} ${language}`, key: character.key as string, text: character.text[language] as string })))
  const names = characters.flatMap((character: Doc) => (["en", "fr"] as const).map((language) => ({ id: `${character._id} ${language}`, name: character.name[language] as string })))

  it("are written in English and in French for every character, and never empty", () => {
    expect(texts).toHaveLength(20)
    for (const { id, text } of texts) {
      expect(typeof text, id).toBe("string")
      expect(text.trim().length, id).toBeGreaterThan(0)
    }
  })

  it("fit the plate of their face: at most 130 characters, 90 on the four faces with the shorter plate, and a name of at most 12", () => {
    for (const { id, key, text } of texts) expect(text.length, id).toBeLessThanOrEqual(SHORT_PLATE.includes(key) ? BUDGET.short : BUDGET.tall)
    for (const { id, name } of names) expect(name.length, id).toBeLessThanOrEqual(BUDGET.name)
  })

  it("are written as the other seeds write: a typographic apostrophe, no double space, no stray space, a plain space before a colon, a full stop at the end of a text", () => {
    for (const { id, text } of texts) {
      expect(text, id).not.toContain("'")
      expect(text, id).toBe(text.trim())
      expect(text, id).not.toMatch(/ {2}|\t|\r|\n|[  ]/)
      expect(text.endsWith("."), id).toBe(true)
    }
    for (const { id, name } of names) {
      expect(name, id).not.toContain("'")
      expect(name, id).toBe(name.trim())
      expect(name, id).not.toMatch(/ {2}|\t|\r|\n|[  ]/)
    }
  })
})

describe("the credits", () => {
  it("name the author and the publisher of the booklet, and no illustrator, which `settings` has no field for", () => {
    const settings = buildSettings()
    expect(settings.creditsAuthors).toBe("Seiji Kanai")
    expect(settings.publisher).toBe("Z-Man Games")
    expect(settings.publisherUrl).toBe("https://www.zmangames.com")
    expect(settings).not.toHaveProperty("creditsIllustrators")
  })
})

describe("the texts", () => {
  const texts = () => buildTexts() as Doc
  /** Every text of the document with where it sits and what it is, in French and English */
  const all = () => [
    ...ERROR_MESSAGES.map(({ code, ...said }) => ({ where: `errorMessages.${code}`, kind: "localeString", said })),
    ...ENGINE_TEXTS.map(({ key, ...said }) => ({ where: `engineTexts.${key}`, kind: "localeText", said })),
  ]

  it("are the one `texts` document of the shared Studio, with the engine's words and the message of the game's own error code, and nothing else", () => {
    expect(texts()._id).toBe("texts")
    expect(Object.keys(texts()).sort()).toEqual(["_id", "_type", "engineTexts", "errorMessages"])
  })

  it("name the three lines of the score once each, and the one code the game refuses with", () => {
    expect(ENGINE_TEXTS.map(({ key }) => key)).toEqual(["score.rounds", "score.won", "score.spy"])
    expect(ERROR_MESSAGES.map(({ code }) => code)).toEqual(["MUST_PLAY_COUNTESS"])
  })

  it("are written in English and in French, and leave Spanish and German empty: nothing is translated that has no source, and the board shows the English", () => {
    const objects = [...(texts().errorMessages as { message: object }[]).map((item) => item.message), ...(texts().engineTexts as { text: object }[]).map((item) => item.text)]
    expect(objects).toHaveLength(4)
    for (const value of objects) expect(Object.keys(value).sort()).toEqual(["_type", "en", "fr"])
  })

  it("follow the typography of the other texts: trimmed, one line, one space at a time, the typographic apostrophe, no marker", () => {
    for (const { where, said } of all()) {
      for (const [language, text] of Object.entries(said)) {
        expect(text, `${where}.${language}`).toBe(text.trim())
        expect(text.length, `${where}.${language}`).toBeGreaterThan(0)
        expect(text, `${where}.${language}`).not.toMatch(/ {2}|\t|[\r\n]/)
        expect(text, `${where}.${language}`).not.toContain("'")
        expect(text, `${where}.${language}`).not.toMatch(/\bTODO\b|\b(tbd|fixme|lorem|ipsum|placeholder|xxx)\b|\?\?|<\/?[a-z]|https?:\/\/|[{}]/i)
      }
    }
  })

  it("are written in their own language: no text is the same in English and in French", () => {
    for (const { where, said } of all()) expect(said.fr, where).not.toBe(said.en)
  })

  it("fit where they are shown: a line of the score is a chip of the end screen, a message is one sentence", () => {
    for (const { where, kind, said } of all()) {
      for (const [language, text] of Object.entries(said)) {
        if (kind === "localeText") {
          expect(text.length, `${where}.${language}`).toBeLessThanOrEqual(24)
          expect(text.endsWith("."), `${where}.${language}`).toBe(false)
        } else {
          expect(text.length, `${where}.${language}`).toBeLessThanOrEqual(120)
          expect(text.endsWith("."), `${where}.${language}`).toBe(true)
        }
      }
    }
  })
})

describe("the art slots", () => {
  it("are the ten faces, the back of the cards, the favor token's symbol and mask, the mat and the logo", () => {
    expect(ART_SLOTS.map((slot) => slot.name)).toEqual([...CHARACTER_KEYS, "card-back", "favor-token-symbol", "favor-token-mask", "mat", "logo"])
    expect(ART_SLOTS).toHaveLength(15)
  })

  it("give the faces and the back the proportions of the owner's pictures, 760 by 1060", () => {
    const cards = ART_SLOTS.filter((slot) => [...CHARACTER_KEYS, "card-back"].includes(slot.name as never))
    expect(cards).toHaveLength(11)
    for (const slot of cards) expect(slot.ratio, slot.name).toEqual([760, 1060])
  })

  it("answer to the names of the owner's files, as they are", () => {
    const files = [...CHARACTER_KEYS.map((key) => `CARD_${key.toUpperCase()}`), "CARD_BACK", "FAVOR_TOKEN_SYMBOL", "FAVOR_TOKEN_MASK", "LOGO_LOVE_LETTER"].map((name) => name.toLowerCase().replaceAll("_", "-"))
    expect(files).toHaveLength(14)
    for (const name of files) expect(ART_SLOTS.filter((slot) => slot.name === name || slot.aliases?.includes(name)), name).toHaveLength(1)
  })

  it("aim at documents of the seed", () => {
    const ids = new Set(seedDocs().map((doc) => doc._id))
    for (const slot of ART_SLOTS) expect(ids.has(slot.docId), slot.name).toBe(true)
  })
})
