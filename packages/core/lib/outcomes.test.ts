import { PLAYER_OUTCOMES } from "@pbgo/engine-kit"
import type { Outcome } from "@pbgo/ui/results"
import { describe, expect, it } from "vitest"

// The history records an `Outcome` for each player and an engine says a `PlayerOutcome`: the second must be inside the first. The assignment fails to compile when the kit gains an outcome that the history does not record.
describe("the outcomes an engine can say", () => {
  it("are all outcomes of the history, which keeps `abandoned` for the platform", () => {
    const recorded: readonly Outcome[] = PLAYER_OUTCOMES
    expect(recorded).not.toContain("abandoned")
  })
})
