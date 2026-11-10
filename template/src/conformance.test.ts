import { conformanceProblems } from "@pbgo/engine-kit/testing"
import { GAME, type State } from "@template/engine"
import { expect, it } from "vitest"
import { ERROR_CODES } from "./lib/site"

// What a seat must never see of the others: the ids of the cards in their hands. A card played is public, and its id is dealt again in the next round: the cards of the trick and of the last trick are the ones the state still shows
const secretsFor = (state: State, viewer: string | null) => {
  const played = JSON.stringify([state.trick, state.lastTrick])
  return state.players.filter((player) => player.id !== viewer).flatMap((player) => player.hand.map((card) => card.id)).filter((id) => !played.includes(JSON.stringify(id)))
}

// The contract of an engine, played the way the server plays it: whole games at several table sizes and for each variant of the options, with the checks of every step. A game made from the template keeps
// this test and keeps it green; the sentences it fails with say which rule of the contract the engine breaks.
it("keeps the contract of an engine", () => {
  const problems = conformanceProblems(GAME, { errorCodes: ERROR_CODES, secretsFor })
  expect(problems).toEqual([])
}, 120_000)
