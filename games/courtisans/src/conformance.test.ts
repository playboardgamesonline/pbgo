import { GAME, type State, isOver } from "@courtisans/engine"
import { conformanceProblems } from "@pbgo/engine-kit/testing"
import { expect, it } from "vitest"
import { ERROR_CODES } from "./lib/site"

// The contract of an engine, played the way the server plays it: whole games at every table size, with the checks of every step (docs/engine/04-build-a-game/06-testing.md). The sentences it fails with say which rule of the contract
// the engine breaks. What a viewer must not learn while the game goes: the cards of the deck and of the cards put aside, the hands of the others and the two missions of each other player. A card that was played is public, so
// are the ones an assassin eliminated (what happened says it), and the end of the game shows the missions. A spy's family is hidden too, but it is no id: the tests of the views check it.
const secretsFor = (state: State, viewer: string | null) => {
  if (isOver(state)) return []
  const seat = viewer === null ? -1 : state.seats.indexOf(viewer)
  return [...state.deck, ...state.setAside, ...state.hands.filter((_, i) => i !== seat).flat(), ...state.missions.filter((_, i) => i !== seat).flat()]
}

it("keeps the contract of an engine", () => {
  expect(conformanceProblems(GAME, { errorCodes: ERROR_CODES, secretsFor })).toEqual([])
}, 120_000)
