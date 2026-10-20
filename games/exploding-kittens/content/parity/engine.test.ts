import { CARDS, DECKS, defaultOptions, OPTIONS } from "@exploding-kittens/engine"
import type { CardKind, DeckEntry } from "@exploding-kittens/engine"
import type { Doc } from "@pbgo/content-kit/testing"
import { describe, expect, expectTypeOf, it } from "vitest"
import { CARD_TYPE_KEYS, CATEGORIES, CATEGORY_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { CategoryKey } from "../../apps/studio/schemaTypes/constants.ts"
import { seedDocs } from "../data/test-fixtures.ts"

// The seed against the engine (GAM-7), read from the engine itself rather than copied: the keys of the card types, the category each one is filed in
// (the engine's `kind`), the lines of a deck and the default of the five-different option are a contract between the two ("append only, never
// rename", says the engine's catalogue).
//
// This folder has its own tsconfig. The engine is a dev dependency that only Vitest reads: the seed runs directly with Node and never imports it.
// The engine loads `@pbgo/engine-kit`, whose `EngineError` has a parameter property: not the erasable syntax the rest of `content/` keeps for Node.

const docsOf = (type: string) => seedDocs().filter((doc) => doc._type === type)
/** The card types of the seed, every category together, in the order of the seed. */
const cardTypeDocs = () => seedDocs().filter((doc) => CATEGORY_KEYS.some((category) => CATEGORIES[category].type === doc._type))
const decks: Record<string, readonly DeckEntry[]> = DECKS
const engineKeys = Object.keys(CARDS)
const engineKinds = Object.fromEntries(Object.entries(CARDS).map(([key, card]) => [key, card.kind]))
/** Where the engine's catalogue puts a card among the cards of its kind, from 0. */
const placeOf = (key: string) => engineKeys.filter((other) => engineKinds[other] === engineKinds[key]).indexOf(key)
type Line = { cardType: string; copies: number }

describe("the seed against the engine", () => {
  it("has the card types of the engine catalogue: the same keys, in the same order", () => {
    expect(cardTypeDocs().map((doc) => doc.key)).toEqual(engineKeys)
    expect([...CARD_TYPE_KEYS]).toEqual(engineKeys)
  })

  it("files each card type in the category of the kind the engine reads: the document type says it", () => {
    expect(Object.fromEntries(cardTypeDocs().map((doc) => [doc.key, doc._type]))).toEqual(
      Object.fromEntries(Object.entries(engineKinds).map(([key, kind]) => [key, CATEGORIES[kind].type])),
    )
  })

  it("puts each card type at its place among the cards of its kind, in the order of the engine catalogue", () => {
    expect(Object.fromEntries(cardTypeDocs().map((doc) => [doc.key, doc.order]))).toEqual(Object.fromEntries(engineKeys.map((key) => [key, placeOf(key)])))
  })

  it("lists the kinds of the engine as categories, no more and no fewer", () => {
    expect([...new Set(Object.values(engineKinds))].sort()).toEqual([...CATEGORY_KEYS].sort())
    // The same at compile time (`pnpm typecheck`): a kind added to the engine's CardKind is a type error here until the Studio has a category for it
    expectTypeOf<CategoryKey>().toEqualTypeOf<CardKind>()
  })

  it("gives each edition the lines of the engine deck of the same key: card types and copies, in the same order", () => {
    const editions = docsOf("edition")
    expect(editions.map((doc) => doc.key)).toContain("original")
    for (const edition of editions as Doc[]) {
      const deck = decks[edition.key]
      expect(deck, `the engine has no deck "${edition.key}"`).toBeDefined()
      const lines = (edition.cards as Line[]).map(({ cardType, copies }) => ({ cardType, copies }))
      expect(lines, edition.key).toEqual((deck ?? []).map(({ type, copies }) => ({ cardType: type, copies })))
    }
  })

  it("turns the five-different combination on by default, as the rules text says", () => {
    // If the engine's default changes, the "Five different" paragraphs of rules.ts (four languages) and the wording test of data.test.ts change with it
    expect(defaultOptions(OPTIONS).fiveDifferent).toBe(true)
  })
})
