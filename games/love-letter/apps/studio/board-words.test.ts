import { expect, it } from "vitest"
import { BOARD_WORDS } from "../../content/data/texts.ts"
import { WORD_FIELDS } from "../../src/lib/words.ts"
import { texts } from "./schemaTypes/texts"

/** The `{placeholders}` of a text, once each. */
const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!))].sort()

type Field = { name: string; title?: string; group?: string }
const board = (texts.fields as Field[]).filter((field) => field.group === "board")

// The Board tab of `texts` holds the words of the board (`WORD_FIELDS` of `src/lib/words.ts`, which the board reads and the seed writes): the Studio, the loader and the seed say the same names, in the same order.
it("lists in the Board tab the words of the board, no more and no fewer, in order", () => {
  expect(board.map((field) => field.name)).toEqual([...WORD_FIELDS])
})

it("names in the title of each word the placeholders that its sentence in the seed fills in", () => {
  for (const field of board) {
    const word = BOARD_WORDS.find((candidate) => candidate.key === field.name)
    expect(placeholders(field.title ?? ""), field.name).toEqual(placeholders(word?.en ?? ""))
  }
})
