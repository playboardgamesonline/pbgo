import { readFileSync } from "node:fs"
import { join } from "node:path"
import { assertSeedId } from "@pbgo/content-kit"
import { describe, expect, it } from "vitest"
import { CARD_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import { DATASET, PROJECT_ID, REPO_ROOT, SLUG } from "../config.ts"
import { ART_SLOTS } from "./art-manifest.ts"
import { CARD_LIST, buildCards, cardId } from "./cards.ts"
import { buildSeedDocs } from "./index.ts"
import { buildSettings } from "./settings.ts"
import { seedDocs } from "./test-fixtures.ts"
import { BOARD_WORDS, ENGINE_TEXTS, ERROR_MESSAGES } from "./texts.ts"

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
