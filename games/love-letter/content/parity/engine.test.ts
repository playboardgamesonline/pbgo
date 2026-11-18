import { CARDS, CATALOGUE, DECK, engineTextKeys, GAME, isSharedErrorCode, OPTIONS } from "@love-letter/engine"
import type { CharacterKey as EngineKey } from "@love-letter/engine"
import { describe, expect, expectTypeOf, it } from "vitest"
import { CHARACTER_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { CharacterKey as StudioKey } from "../../apps/studio/schemaTypes/constants.ts"
import { ERROR_CODES } from "../../src/lib/site.ts"
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

describe("the seed's words of the engine", () => {
  const keysInSeed = () => ((docsById().get("texts")?.engineTexts as { key: string }[] | undefined) ?? []).map((item) => item.key)

  it("hold the keys the engine asks of the game's Sanity, no more and no fewer", () => {
    const { required, optional } = engineTextKeys(GAME)
    expect([...keysInSeed()].sort()).toEqual([...required, ...optional].sort())
  })

  it("are the lines of the score the engine lists, in its order: the rounds played, the rounds won and the Spy's tokens", () => {
    expect(GAME.scoreLines).toEqual(["rounds", "won", "spy"])
    expect(keysInSeed()).toEqual(GAME.scoreLines!.map((line) => `score.${line}`))
  })

  it("name each text once, with a key of its own to merge by", () => {
    const items = (docsById().get("texts")?.engineTexts ?? []) as { _key: string; key: string }[]
    expect(new Set(items.map((item) => item._key)).size).toBe(items.length)
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length)
  })

  it("are keyed as the Copy page of the gamemaster keys them, so that a text edited there is not added a second time", () => {
    // Every character outside letters, digits, `_` and `-` becomes `_` (`core/server/settings.ts`): the items are paired by `_key` when the seed merges
    const items = (docsById().get("texts")?.engineTexts ?? []) as { _key: string; key: string }[]
    for (const item of items) expect(item._key, item.key).toBe(item.key.replace(/[^A-Za-z0-9_-]/g, "_"))
  })

  it("leave the engine with no word of its own: an option says none, and a line of the score is a key", () => {
    for (const definition of Object.values(OPTIONS)) {
      expect(definition).not.toHaveProperty("label")
      expect(definition).not.toHaveProperty("help")
    }
  })
})

describe("the seed's messages of the game's own error codes", () => {
  const messages = () => (docsById().get("texts")?.errorMessages ?? []) as { _key: string; code: string }[]

  it("word the codes the binding lists in `ERROR_CODES`, no more and no fewer", () => {
    expect(ERROR_CODES).toEqual(["MUST_PLAY_COUNTESS"])
    expect(messages().map((message) => message.code).sort()).toEqual([...ERROR_CODES].sort())
  })

  it("leave the shared codes to the platform, which words them", () => {
    for (const { code } of messages()) expect(isSharedErrorCode(code), code).toBe(false)
  })

  it("are keyed by their code, as the Copy page keys them", () => {
    for (const message of messages()) expect(message._key, message.code).toBe(message.code)
  })
})
