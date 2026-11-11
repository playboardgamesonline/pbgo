import { GAME, type State } from "@flip-7/engine"
import { conformanceProblems } from "@pbgo/engine-kit/testing"
import { expect, it } from "vitest"
import { ERROR_CODES } from "./lib/site"

// The contract of an engine, played the way the server plays it: whole games at every table size and for each option, with the checks of every step (docs/engine/04-build-a-game/06-testing.md). The sentences it fails with say which rule of the contract
// the engine breaks. The one hidden thing of Flip 7 is the draw pile: no viewer may be shown the id of a card that is in it (an opaque id is a number, and a number is looked for as a number). The codes the engine refuses with must be the shared ones
// or the ones this binding lists.
const secretsFor = (state: State) => state.deck

it("keeps the contract of an engine", () => {
  expect(conformanceProblems(GAME, { errorCodes: ERROR_CODES, secretsFor })).toEqual([])
}, 120_000)
