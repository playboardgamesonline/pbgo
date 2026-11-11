import { LANGUAGE_IDS } from "@pbgo/content-kit"
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
