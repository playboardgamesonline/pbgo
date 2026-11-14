import { conformanceProblems } from "@pbgo/engine-kit/testing"
import { expect, it } from "vitest"
import { GAME } from "./game"
import type { State } from "./types"

// The contract of an engine, played the way the server plays it (docs/engine/04-build-a-game/06-testing.md). Hidden in Skyjo: the draw pile and the
// cards face down in the grids: no viewer may be shown the id of one. The engine's own codes are the ones of its binding's `ERROR_CODES`.
const ERROR_CODES = ["INVALID_POSITION", "CARD_FACE_UP", "MUST_PLACE"]
const secretsFor = (state: State) => [...state.deck, ...state.grids.flat().flatMap((cell) => (cell && !cell.up ? [cell.card] : []))]

it("keeps the contract of an engine", () => {
  expect(conformanceProblems(GAME, { errorCodes: ERROR_CODES, secretsFor })).toEqual([])
}, 120_000)
