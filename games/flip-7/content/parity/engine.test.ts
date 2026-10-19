import { CARDS, DECK, defaultOptions, OPTIONS } from "@flip-7/engine"
import type { CardKind } from "@flip-7/engine"
import { describe, expect, expectTypeOf, it } from "vitest"
import { CATEGORY_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { CategoryKey } from "../../apps/studio/schemaTypes/constants.ts"
import { CARD_LIST } from "../data/cards.ts"
import { seedDocs } from "../data/test-fixtures.ts"

// The seed against the engine, read from the engine itself rather than copied: the categories of the cards, their keys, their copies and
// their order are a contract between the two ("append only, never rename", says the engine's catalogue).
//
// This folder has its own tsconfig. The engine is a dev dependency that only Vitest reads: the seed runs directly with Node and never
// imports it. The engine loads `@pbgo/engine-kit`, whose `EngineError` has a parameter property: not the erasable syntax the rest of
// `content/` keeps for Node.

const engineKeys = Object.keys(CARDS)
const engineCard = (key: string) => CARDS[key as keyof typeof CARDS]
/** The cards of one kind in the engine, in the order of its catalogue. */
const engineKeysOf = (kind: string) => engineKeys.filter((key) => engineCard(key).kind === kind)
const docsById = () => new Map(seedDocs().map((doc) => [doc._id, doc]))

describe("the seed against the engine", () => {
  it("has the cards of the engine catalogue: every key once, whatever the category it sits in", () => {
    expect(CARD_LIST.map((card) => card.engineKey).sort()).toEqual([...engineKeys].sort())
  })

  it("files each card in the category of its kind in the engine, in the order of the engine catalogue", () => {
    for (const category of CATEGORY_KEYS) {
      expect(CARD_LIST.filter((card) => card.category === category).map((card) => card.engineKey), category).toEqual(engineKeysOf(category))
    }
  })

  it("lists the kinds of the engine as categories, no more and no fewer", () => {
    expect([...new Set(Object.values(CARDS).map((card) => card.kind))].sort()).toEqual([...CATEGORY_KEYS].sort())
    // The same at compile time (`pnpm typecheck`): a kind added to the engine's CardKind is a type error here until the Studio has it too
    expectTypeOf<CategoryKey>().toEqualTypeOf<CardKind>()
  })

  it("gives each card the copies of the engine deck, and the place of its entry among the cards of its kind", () => {
    expect(DECK.map(({ type }) => type)).toEqual(engineKeys)
    const byId = docsById()
    for (const card of CARD_LIST) {
      const doc = byId.get(card.id)
      const entry = DECK.find(({ type }) => type === card.engineKey)
      expect(entry, `the engine deck has no ${card.engineKey}`).toBeDefined()
      expect(doc?.copies, card.engineKey).toBe(entry?.copies)
      expect(doc?.order, card.engineKey).toBe(card.order)
      expect(doc?.order, card.engineKey).toBe(engineKeysOf(card.category).indexOf(card.engineKey))
    }
    const total = CARD_LIST.reduce((sum, card) => sum + (byId.get(card.id)?.copies as number), 0)
    expect(total).toBe(DECK.reduce((sum, { copies }) => sum + copies, 0))
  })

  it("keys and names the cards as they read: the value of a number, the sign of a modifier", () => {
    const byId = docsById()
    for (const card of CARD_LIST) {
      const engine = engineCard(card.engineKey)
      const doc = byId.get(card.id)
      if (engine.kind === "number") {
        expect(card.key, card.engineKey).toBe(String(engine.value))
        expect(doc?.name.en, card.engineKey).toBe(String(engine.value))
      }
      if (engine.kind === "modifier") {
        expect(card.key, card.engineKey).toBe(engine.times > 1 ? `times-${engine.times}` : `plus-${engine.plus}`)
        expect(doc?.name.en, card.engineKey).toBe(engine.times > 1 ? `x${engine.times}` : `+${engine.plus}`)
      }
      if (engine.kind === "action") expect(card.key, card.engineKey).toBe(card.engineKey)
    }
  })

  it("reads the score of 200 the rules say, and no other, as the default of the only option", () => {
    // If the engine's default changes, the lobby, the rules text and the share image change with it
    expect(defaultOptions(OPTIONS)).toEqual({ targetScore: 200 })
  })
})
