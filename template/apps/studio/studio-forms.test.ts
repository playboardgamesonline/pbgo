import { formProblems, studioTypes } from "@pbgo/content-kit/form-rules"
import { expect, it } from "vitest"
import studio from "./sanity.config"

// The rules every Studio form follows ("Studio forms" in the root CLAUDE.md): no description under a field, the game document in tabs.
it("follows the rules of the Studio forms", () => {
  expect(formProblems(studioTypes(studio))).toEqual([])
})
