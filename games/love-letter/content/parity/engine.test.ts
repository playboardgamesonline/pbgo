import { CARDS, CATALOGUE, DECK, OPTIONS } from "@love-letter/engine"
import type { CharacterKey as EngineKey } from "@love-letter/engine"
import { describe, expect, expectTypeOf, it } from "vitest"
import { CHARACTER_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { CharacterKey as StudioKey } from "../../apps/studio/schemaTypes/constants.ts"
import { CHARACTER_LIST } from "../data/characters.ts"
import { seedDocs } from "../data/test-fixtures.ts"

// The Studio and the seed against the engine, read from the engine itself rather than copied: the ten characters, their keys, their printed values and their quantities are a contract between the three ("append only, never rename", says the
// engine's catalogue).
//
// This folder has its own tsconfig. The engine is a dev dependency that only Vitest reads: the seed runs directly with Node and never imports it. The engine loads `@pbgo/engine-kit`, whose `EngineError` has a parameter property: not the erasable
// syntax the rest of `content/` keeps for Node.

const engineKeys = Object.keys(CARDS)
const docsById = () => new Map(seedDocs().map((doc) => [doc._id, doc]))

describe("the Studio and the seed against the engine", () => {
  it("list the characters of the engine catalogue in the Studio: every key once, in the order of the engine", () => {
    expect([...CHARACTER_KEYS]).toEqual(engineKeys)
  })

  it("agree at compile time on the keys: a key added on one side only is a type error here (`pnpm typecheck`)", () => {
    expectTypeOf<StudioKey>().toEqualTypeOf<EngineKey>()
  })

  it("seed the characters of the engine catalogue: every key once, in the order of the engine", () => {
    expect(CHARACTER_LIST.map((character) => character.key)).toEqual(engineKeys)
    expect(seedDocs().filter((doc) => doc._type === "character")).toHaveLength(engineKeys.length)
  })

  it("give each character the number printed on it, the value of the engine", () => {
    const byId = docsById()
    for (const { key, id } of CHARACTER_LIST) expect(byId.get(id)?.value, key).toBe(CARDS[key].value)
  })

  it("give each character the quantity of the engine deck", () => {
    expect(DECK.map(({ type }) => type)).toEqual(engineKeys)
    const byId = docsById()
    for (const { key, id } of CHARACTER_LIST) {
      const entry = DECK.find(({ type }) => type === key)
      expect(entry, `the engine deck has no ${key}`).toBeDefined()
      expect(byId.get(id)?.quantity, key).toBe(entry?.copies)
    }
  })

  it("hold the 21 cards of the box", () => {
    const byId = docsById()
    const total = CHARACTER_LIST.reduce((sum, { id }) => sum + (byId.get(id)?.quantity as number), 0)
    expect(total).toBe(21)
    expect(total).toBe(CATALOGUE.length)
  })
})

describe("the options", () => {
  it("are none: the number of favor tokens that wins is the rules' and no setting moves it", () => {
    expect(OPTIONS).toEqual({})
  })
})
