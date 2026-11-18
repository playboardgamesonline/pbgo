import { GAME, type State } from "@love-letter/engine"
import { conformanceProblems } from "@pbgo/engine-kit/testing"
import { expect, it } from "vitest"
import { ERROR_CODES } from "./lib/site"

// The contract of an engine, played the way the server plays it: whole games at every table size, with the checks of every step (docs/engine/04-build-a-game/06-testing.md). The sentences it fails with say which rule of the contract the engine
// breaks. It ran from the engine package until the binding came, which took it over (it plays whole games and takes 15 s, so two copies would cost twice for nothing).
//
// What a viewer must never see: the deck, the card set aside face down and the hands of the other players (an opaque id is a number, and a number is looked for as a number). Once a round ended on a comparison the players still in laid their hands
// face up (p. 6), so those hands are public until the next round is dealt; a round that ended with one player left reveals nothing. The codes the engine refuses with must be the shared ones or the ones this binding lists.
const secretsFor = (state: State, viewer: string | null) => {
  const shown = state.stage.kind === "between" && state.stage.revealed
  const hands = shown ? [] : state.seats.flatMap((id, seat) => (id === viewer ? [] : state.hands[seat]!))
  return [...state.deck, ...(state.aside === null ? [] : [state.aside]), ...hands]
}

it("keeps the contract of an engine", () => {
  expect(conformanceProblems(GAME, { errorCodes: ERROR_CODES, secretsFor })).toEqual([])
}, 120_000)
