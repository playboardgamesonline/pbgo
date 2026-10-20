import { CARDS, DECKS, defaultOptions, OPTIONS } from "@exploding-kittens/engine"
import type { CardKind, DeckEntry } from "@exploding-kittens/engine"
import type { Doc } from "@pbgo/content-kit/testing"
import { describe, expect, expectTypeOf, it } from "vitest"
import { CARD_TYPE_KEYS, KIND_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { KindKey } from "../../apps/studio/schemaTypes/constants.ts"
import { seedDocs } from "../data/test-fixtures.ts"

// The seed against the engine (GAM-7), read from the engine itself rather than copied: the keys of the card types, their kinds, the lines of a deck
// and the default of the five-different option are a contract between the two ("append only, never rename", says the engine's catalogue).
//
// This folder has its own tsconfig. The engine is a dev dependency that only Vitest reads: the seed runs directly with Node and never imports it.
// The engine loads `@pbgo/engine-kit`, whose `EngineError` has a parameter property: not the erasable syntax the rest of `content/` keeps for Node.

const docsOf = (type: string) => seedDocs().filter((doc) => doc._type === type)
const decks: Record<string, readonly DeckEntry[]> = DECKS
const engineKeys = Object.keys(CARDS)
const engineKinds = Object.fromEntries(Object.entries(CARDS).map(([key, card]) => [key, card.kind]))
type Line = { cardType: string; copies: number }

describe("the seed against the engine", () => {
  it("has the card types of the engine catalogue: the same keys, in the same order", () => {
    expect(docsOf("cardType").map((doc) => doc.key)).toEqual(engineKeys)
    expect([...CARD_TYPE_KEYS]).toEqual(engineKeys)
  })

  it("gives each card type the kind the engine reads", () => {
    expect(Object.fromEntries(docsOf("cardType").map((doc) => [doc.key, doc.kind]))).toEqual(engineKinds)
  })

  it("lists the kinds of the engine, no more and no fewer", () => {
    expect([...new Set(Object.values(engineKinds))].sort()).toEqual([...KIND_KEYS].sort())
    // The same at compile time (`pnpm typecheck`): a kind added to the engine's CardKind is a type error here until the Studio has it too
    expectTypeOf<KindKey>().toEqualTypeOf<CardKind>()
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

  it("turns the five-different combination on by default, as the official Original rules do", () => {
    expect(defaultOptions(OPTIONS).fiveDifferent).toBe(true)
  })
})
