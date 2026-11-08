import { errorVocabularyProblems } from "@pbgo/engine-kit/testing"
import { expect, it } from "vitest"
import { ERROR_CODES } from "./lib/site"

// Every game speaks the same error vocabulary: the shared codes, which the platform words, and the game's own, listed in `ERROR_CODES` and worded in Sanity.
it("throws only the shared codes and the codes it lists, and lists only its own", () => {
  expect(errorVocabularyProblems({ engineDir: new URL("../packages/engine/src", import.meta.url), own: ERROR_CODES })).toEqual([])
})
