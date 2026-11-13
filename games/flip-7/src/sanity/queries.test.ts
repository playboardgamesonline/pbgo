import { describe, expect, it } from "vitest"
import { WORD_FIELDS } from "../lib/words"
import { CATALOG_QUERY } from "./queries"

describe("the catalog query", () => {
  it("asks Sanity for every word of the board, so that a word added to the list is fetched", () => {
    const texts = CATALOG_QUERY.match(/"texts": \*\[_id == "texts"\]\[0\]\{([^}]*)\}/)?.[1] ?? ""
    const asked = texts.split(",").map((name) => name.trim()).filter(Boolean)
    expect(asked.sort()).toEqual([...WORD_FIELDS].sort())
  })
})
