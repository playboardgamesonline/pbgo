import { LANGUAGE_IDS } from "@pbgo/content-kit"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { WORD_FIELDS } from "../../src/lib/words.ts"
import { BOARD_WORDS } from "./texts.ts"
import { seedDocs } from "./test-fixtures.ts"

/** The `{placeholders}` of a text, once each. */
const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!))].sort()

// The words of the board are the fields of the "Board" tab of `texts` (`WORD_FIELDS`), one `localeString` each in the seed. The Studio side is kept equal in `apps/studio/board-words.test.ts`.
describe("the seed's words of the board", () => {
  it("are the fields of the Board tab, no more and no fewer, in order", () => {
    expect(BOARD_WORDS.map((word) => word.key)).toEqual([...WORD_FIELDS])
  })

  it("are written in the four languages, and a language names the same placeholders as the others", () => {
    for (const word of BOARD_WORDS) {
      for (const language of LANGUAGE_IDS) expect(word[language], `${word.key} (${language})`).toBeTruthy()
      const english = placeholders(word.en)
      for (const language of LANGUAGE_IDS) expect(placeholders(word[language]), `${word.key} (${language})`).toEqual(english)
    }
  })

  it("only name what the board fills in: a target player, a card, points or a number (the history leaves out who acts: the ticker names them)", () => {
    const known = ["card", "number", "points", "target"]
    for (const word of BOARD_WORDS) for (const name of placeholders(word.en)) expect(known, `${word.key} {${name}}`).toContain(name)
  })

  it("are in the `texts` document under the name of their field, each a localeString", () => {
    const texts = seedDocs().find((doc) => doc._id === "texts")!
    for (const word of BOARD_WORDS) expect((texts[word.key] as { _type: string })._type, word.key).toBe("localeString")
  })
})

/** Every source file under `dir`, but the tests */
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })

/** The words the board and its screen read: every `words.<name>` of the code that draws, announces or tells the history. */
const used = () => {
  const found = new Set<string>()
  for (const file of [...sources(join(import.meta.dirname, "../../src/components")), join(import.meta.dirname, "../../src/lib/history.ts")]) {
    for (const match of readFileSync(file, "utf8").matchAll(/\bwords\.(\w+)/g)) found.add(match[1]!)
  }
  return found
}

// A word the board draws that the seed does not write reads `[missing: <key>]` on the table until somebody types it in the Studio: this is what stops it from shipping.
describe("the words the code reads", () => {
  it("are all fields of the Board tab", () => {
    for (const name of used()) expect([...WORD_FIELDS], `words.${name} is read but is no field`).toContain(name)
  })

  it("are all written in English in the seed, so the owner's seed run fills them in", () => {
    const texts = seedDocs().find((doc) => doc._id === "texts")!
    for (const name of used()) {
      const word = BOARD_WORDS.find((candidate) => candidate.key === name)
      expect(word, `words.${name} is read by the board but absent from the seed`).toBeDefined()
      expect(word!.en.trim(), `words.${name} has no English text`).not.toBe("")
      expect(texts[name], `words.${name} is not in the texts document`).toBeDefined()
    }
  })

  it("leave no word of the seed unread: a word nobody draws is dead", () => {
    const read = used()
    for (const field of WORD_FIELDS) expect(read, `${field} is declared and written but nothing reads it`).toContain(field)
  })

  it("cover what the floor buttons and the zones say: hit, stay, deal, a prompt for each action card and the name of a player's zone", () => {
    for (const name of ["hit", "stay", "deal", "targetFreeze", "targetFlipThree", "targetSecondChance", "targetPlayer"]) expect([...used()], name).toContain(name)
  })
})
