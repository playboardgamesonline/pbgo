import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { WORD_FIELDS } from "../../src/lib/words.ts"
import { seedDocs } from "./test-fixtures.ts"
import { BOARD_WORDS } from "./texts.ts"

/** The `{placeholders}` of a text, once each. */
const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!))].sort()

// The words of the board are the fields of the "Board" tab of `texts` (`WORD_FIELDS`), one `localeString` each in the seed. The Studio side is kept equal in `apps/studio/board-words.test.ts`.
describe("the seed's words of the board", () => {
  it("are the fields of the Board tab, no more and no fewer, in order", () => {
    expect(BOARD_WORDS.map((word) => word.key)).toEqual([...WORD_FIELDS])
  })

  it("are written in English and in French, and a language names the same placeholders as the other", () => {
    for (const word of BOARD_WORDS) {
      expect(word.en.trim().length, `${word.key} (en)`).toBeGreaterThan(0)
      expect(word.fr.trim().length, `${word.key} (fr)`).toBeGreaterThan(0)
      expect(placeholders(word.fr), word.key).toEqual(placeholders(word.en))
    }
  })

  it("only name what the board fills in: a round number, a count of favor tokens or the name of a player", () => {
    const known = ["count", "number", "target"]
    for (const word of BOARD_WORDS) for (const name of placeholders(word.en)) expect(known, `${word.key} {${name}}`).toContain(name)
  })

  it("follow the typography of the other texts: trimmed, one line, one space at a time, the typographic apostrophe, no marker, no space that does not break", () => {
    for (const word of BOARD_WORDS) {
      for (const [language, text] of [["en", word.en], ["fr", word.fr]] as const) {
        const where = `${word.key} (${language})`
        expect(text, where).toBe(text.trim())
        expect(text, where).not.toMatch(/ {2}|\t|[\r\n]|[\u00a0\u202f]/)
        expect(text, where).not.toContain("'")
        expect(text, where).not.toMatch(/\bTODO\b|\b(tbd|fixme|lorem|ipsum|placeholder|xxx)\b|\?\?|<\/?[a-z]|https?:\/\//i)
        expect(text.length, where).toBeLessThanOrEqual(60)
      }
    }
  })

  it("are written in their own language: no word is the same in English and in French but for the numbers in it", () => {
    for (const word of BOARD_WORDS) expect(word.fr, word.key).not.toBe(word.en)
  })

  it("are in the `texts` document under the name of their field, each a localeString with English and French and nothing else", () => {
    const texts = seedDocs().find((doc) => doc._id === "texts")!
    for (const word of BOARD_WORDS) {
      const value = texts[word.key] as { _type: string } & Record<string, string>
      expect(value._type, word.key).toBe("localeString")
      expect(Object.keys(value).sort(), word.key).toEqual(["_type", "en", "fr"])
      expect(value.en, word.key).toBe(word.en)
      expect(value.fr, word.key).toBe(word.fr)
    }
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
  const history = join(import.meta.dirname, "../../src/lib/history.ts")
  for (const file of [...sources(join(import.meta.dirname, "../../src/components")), ...(existsSync(history) ? [history] : [])]) {
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
})
