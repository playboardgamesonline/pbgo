import { CARDS, DECK, defaultOptions, OPTIONS } from "@flip-7/engine"
import type { CardKind } from "@flip-7/engine"
import { describe, expect, expectTypeOf, it } from "vitest"
import { CARD_TYPE_KEYS, KIND_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { KindKey } from "../../apps/studio/schemaTypes/constants.ts"
import { seedDocs } from "../data/test-fixtures.ts"

// The seed against the engine, read from the engine itself rather than copied: the keys of the card faces, their kinds, their copies and
// their order are a contract between the two ("append only, never rename", says the engine's catalogue).
//
// This folder has its own tsconfig. The engine is a dev dependency that only Vitest reads: the seed runs directly with Node and never
// imports it. The engine loads `@pbgo/engine-kit`, whose `EngineError` has a parameter property: not the erasable syntax the rest of
// `content/` keeps for Node.

const cardTypes = () => seedDocs().filter((doc) => doc._type === "cardType")
const engineKeys = Object.keys(CARDS)

describe("the seed against the engine", () => {
  it("has the card faces of the engine catalogue: the same keys, in the same order", () => {
    expect(cardTypes().map((doc) => doc.key)).toEqual(engineKeys)
    expect([...CARD_TYPE_KEYS]).toEqual(engineKeys)
  })

  it("gives each face the kind the engine reads", () => {
    expect(Object.fromEntries(cardTypes().map((doc) => [doc.key, doc.kind]))).toEqual(Object.fromEntries(Object.entries(CARDS).map(([key, card]) => [key, card.kind])))
  })

  it("lists the kinds of the engine, no more and no fewer", () => {
    expect([...new Set(Object.values(CARDS).map((card) => card.kind))].sort()).toEqual([...KIND_KEYS].sort())
    // The same at compile time (`pnpm typecheck`): a kind added to the engine's CardKind is a type error here until the Studio has it too
    expectTypeOf<KindKey>().toEqualTypeOf<CardKind>()
  })

  it("gives each face the copies of the engine deck, and the place of its entry in it", () => {
    expect(DECK.map(({ type }) => type)).toEqual(engineKeys)
    for (const doc of cardTypes()) {
      const entry = DECK.find(({ type }) => type === doc.key)
      expect(entry, `the engine deck has no ${doc.key}`).toBeDefined()
      expect(doc.copies, doc.key).toBe(entry?.copies)
      expect(doc.order, doc.key).toBe(DECK.findIndex(({ type }) => type === doc.key))
    }
    expect(cardTypes().reduce((total, doc) => total + (doc.copies as number), 0)).toBe(DECK.reduce((total, { copies }) => total + copies, 0))
  })

  it("names the faces as the cards read: the value of a number, the sign of a modifier", () => {
    for (const doc of cardTypes()) {
      const card = CARDS[doc.key as keyof typeof CARDS]
      if (card.kind === "number") expect(doc.name.en, doc.key).toBe(String(card.value))
      if (card.kind === "modifier") expect(doc.name.en, doc.key).toBe(card.times > 1 ? `x${card.times}` : `+${card.plus}`)
    }
  })

  it("reads the score of 200 the rules say, and no other, as the default of the only option", () => {
    // If the engine's default changes, the lobby, the rules text and the share image change with it
    expect(defaultOptions(OPTIONS)).toEqual({ targetScore: 200 })
  })
})
