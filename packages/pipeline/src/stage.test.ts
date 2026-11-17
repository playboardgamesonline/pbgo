import { describe, expect, it } from "vitest"
import { gateArgs, stageLines, STAGES } from "./stage.ts"

// The report of `pnpm check:game`, as the script prints it (scripts/check-game.mjs): a header for each stage, a line for each check, then a summary.
const REPORT_STAGE = `
scaffold
  ✓ registered: registered (live false, indexable false)
  ✓ sanity project: Sanity project abc123
  ✓ files: the packages of a game are there

engine
  • rules spec: no rules spec (docs/games/x/rules.md): \`game-rules-spec\` writes it, and the engine is written from it
  ✗ own engine: still the template's demo engine (\`src/demo\`)
  ✓ pure: no clock, no I/O, no UI, no stray Math.random

binding
  ✗ exports GAME: the binding does not export \`GAME\`: the game is not playable

board (beyond the gate)
  ✗ a board: no board yet (src/components/board)

x has got as far as: scaffold. Not ready for after engine: 1 to fix.
`

const REPORT_ONLY = `
scaffold (not this gate)
  ✗ files: missing package.json

content
  • plan: CLAUDE.md still describes the template's demo game
  ✓ studio guard: the Studio has its guard of forms

live (not this gate)
  ✗ flags: not live: \`live\` and \`indexable\` are false

x has got as far as: nothing. The stage content passes.
`

describe("the gate of a stage", () => {
  it("has the stages in their order, and the arguments that make the script a gate", () => {
    expect(STAGES).toEqual(["scaffold", "engine", "binding", "board", "content", "live"])
    expect(gateArgs({ stage: "engine" })).toEqual(["--stage", "engine"])
    expect(gateArgs({ stage: "content", only: true })).toEqual(["--only", "content"])
  })

  it("says the summary first, then what fails and what wants a look, of the stages that count only", () => {
    expect(stageLines(REPORT_STAGE)).toEqual([
      "x has got as far as: scaffold. Not ready for after engine: 1 to fix.",
      "engine: own engine: still the template's demo engine (`src/demo`)",
      "binding: exports GAME: the binding does not export `GAME`: the game is not playable",
      "look at engine: rules spec: no rules spec (docs/games/x/rules.md): `game-rules-spec` writes it, and the engine is written from it",
    ])
  })

  it("leaves out the stages that the gate does not count, whichever flag said so", () => {
    const lines = stageLines(REPORT_ONLY)
    expect(lines).toEqual(["x has got as far as: nothing. The stage content passes.", "look at content: plan: CLAUDE.md still describes the template's demo game"])
    expect(lines.join("\n")).not.toContain("package.json")
    expect(lines.join("\n")).not.toContain("flags")
    expect(stageLines(REPORT_STAGE).join("\n")).not.toContain("a board")
  })

  it("is the summary alone when everything passes", () => {
    expect(stageLines("\nscaffold\n  ✓ registered: ok\n\nx has got as far as: scaffold. Ready for what follows scaffold.\n")).toEqual(["x has got as far as: scaffold. Ready for what follows scaffold."])
  })

  it("is what the script printed when it printed no report: a game that is not there, a wrong flag", () => {
    expect(stageLines("There is no game nope: games/nope does not exist.\n")).toEqual(["There is no game nope: games/nope does not exist."])
    expect(stageLines("")).toEqual(["the check printed nothing"])
    expect(stageLines(Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n"))).toHaveLength(8)
  })
})
