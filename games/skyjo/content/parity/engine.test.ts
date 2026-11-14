import { CARDS, DECK, GAME, OPTIONS, bandOf, engineTextKeys, isSharedErrorCode } from "@skyjo/engine"
import { describe, expect, it } from "vitest"
import { BANDS, CARD_KEYS, engineKeyOf } from "../../apps/studio/schemaTypes/constants.ts"
import { ERROR_CODES } from "../../src/lib/site.ts"
import { CARD_LIST } from "../data/cards.ts"
import { seedDocs } from "../data/test-fixtures.ts"

// The seed against the engine, read from the engine itself rather than copied: the faces of the cards, their keys, their quantities, their colours and their order are a contract between the two ("append only, never rename", says the engine's catalogue).
//
// This folder has its own tsconfig. The engine is a dev dependency that only Vitest reads: the seed runs directly with Node and never imports it. The engine loads `@pbgo/engine-kit`, whose `EngineError` has a parameter property: not the erasable
// syntax the rest of `content/` keeps for Node.

const engineKeys = Object.keys(CARDS)
const docsById = () => new Map(seedDocs().map((doc) => [doc._id, doc]))

describe("the seed against the engine", () => {
  it("has the cards of the engine catalogue: every key once, in the order of the engine", () => {
    expect(CARD_LIST.map((card) => card.engineKey)).toEqual(engineKeys)
    expect(CARD_KEYS.map(engineKeyOf)).toEqual(engineKeys)
  })

  it("gives each card the quantity of the engine deck, and its place in the list", () => {
    expect(DECK.map(({ type }) => type)).toEqual(engineKeys)
    const byId = docsById()
    for (const card of CARD_LIST) {
      const doc = byId.get(card.id)
      const entry = DECK.find(({ type }) => type === card.engineKey)
      expect(entry, `the engine deck has no ${card.engineKey}`).toBeDefined()
      expect(doc?.quantity, card.engineKey).toBe(entry?.copies)
      expect(doc?.order, card.engineKey).toBe(engineKeys.indexOf(card.engineKey))
    }
    expect(CARD_LIST.reduce((sum, card) => sum + (byId.get(card.id)?.quantity as number), 0)).toBe(DECK.reduce((sum, { copies }) => sum + copies, 0))
  })

  it("files each card in the colour band the engine gives its value", () => {
    const byId = docsById()
    for (const card of CARD_LIST) expect(byId.get(card.id)?.band, card.engineKey).toBe(bandOf(CARDS[card.engineKey as keyof typeof CARDS].value))
    expect(BANDS.map((band) => band.value)).toEqual(["dark-blue", "light-blue", "green", "yellow", "red"])
  })

  it("keys the cards as they read: the figure of the value, with `minus-` for a negative one", () => {
    for (const card of CARD_LIST) {
      const { value } = CARDS[card.engineKey as keyof typeof CARDS]
      expect(card.key, card.engineKey).toBe(value < 0 ? `minus-${-value}` : String(value))
    }
  })

  it("has no option: the target of 100 is the rules'", () => {
    expect(OPTIONS).toEqual({})
  })
})

describe("the seed's words of the engine", () => {
  const keysInSeed = () => ((docsById().get("texts")?.engineTexts as { key: string }[] | undefined) ?? []).map((item) => item.key)

  it("hold the keys the engine asks of the game's Sanity, no more and no fewer", () => {
    const { required, optional } = engineTextKeys(GAME)
    expect([...keysInSeed()].sort()).toEqual([...required, ...optional].sort())
  })

  it("name each text once, with a key of its own to merge by", () => {
    const items = (docsById().get("texts")?.engineTexts ?? []) as { _key: string; key: string }[]
    expect(new Set(items.map((item) => item._key)).size).toBe(items.length)
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length)
  })

  it("are keyed as the Copy page of the gamemaster keys them, so that a text edited there is not added a second time", () => {
    const items = (docsById().get("texts")?.engineTexts ?? []) as { _key: string; key: string }[]
    for (const item of items) expect(item._key, item.key).toBe(item.key.replace(/[^A-Za-z0-9_-]/g, "_"))
  })
})

describe("the seed's messages of the game's own error codes", () => {
  const messages = () => (docsById().get("texts")?.errorMessages ?? []) as { _key: string; code: string }[]

  it("word the codes the binding lists in `ERROR_CODES`, no more and no fewer", () => {
    expect(messages().map((message) => message.code).sort()).toEqual([...ERROR_CODES].sort())
  })

  it("leave the shared codes to the platform, which words them", () => {
    for (const { code } of messages()) expect(isSharedErrorCode(code), code).toBe(false)
  })

  it("are keyed by their code, as the Copy page keys them", () => {
    for (const message of messages()) expect(message._key, message.code).toBe(message.code)
  })
})
