import { afterEach, describe, expect, it, vi } from "vitest"
import { step } from "./actions"
import { autoPlayFor } from "./autoplay"
import { GAME } from "./game"
import { waitingFor } from "./machine"
import { newState, players, seedOf } from "./test-utils"
import type { Action, CourtisansEvent, State } from "./types"

const SEED = 2 ** 40 + 12345
const table = players(3)

/** Plays a whole game for the absent players, rebuilding the actions it took from what each step said. */
function playToEnd(seed: number): { state: State; actions: Action[] } {
  let state = GAME.setup({ players: table, options: {}, seed })
  const actions: Action[] = []
  while (!GAME.isOver(state)) {
    const waiting = waitingFor(state)[0]!
    const played = GAME.autoPlayStep!(state, waiting)
    const events = played.events.map((entry) => entry.event)
    if (state.read.every(Boolean)) {
      events.forEach((event: CourtisansEvent, i) => {
        if (event.type !== "cardPlayed") return
        // an assassination is said right after the assassin is played
        const next = events[i + 1]
        actions.push({ type: "playCard", playerId: event.playerId, cardId: event.card.id, target: event.target, ...(next?.type === "cardEliminated" ? { victimId: next.card.id } : {}) })
      })
    } else actions.push({ type: "readMissions", playerId: waiting })
    state = played.state
  }
  return { state, actions }
}

describe("determinism", () => {
  afterEach(() => vi.restoreAllMocks())

  it("sets up the same game from the same seed, and another one from another seed", () => {
    const setup = (seed: number) => GAME.setup({ players: table, options: {}, seed })
    expect(setup(SEED)).toEqual(setup(SEED))
    expect(setup(SEED).deck).not.toEqual(setup(SEED + 1).deck)
    expect(setup(seedOf(1))).not.toEqual(setup(seedOf(2)))
  })

  it("never calls Math.random once a seed is given (setup, autoPlayFor, debug)", () => {
    const random = vi.spyOn(Math, "random")
    const state = GAME.setup({ players: table, options: {}, seed: SEED })
    GAME.debug!.over!(autoPlayFor(state, "ana"))
    expect(random).not.toHaveBeenCalled()
  })

  it("plays for the same player the same moves from the same state", () => {
    const state = GAME.debug!.missions!(GAME.setup({ players: table, options: {}, seed: SEED }))
    const [active] = waitingFor(state)
    expect(autoPlayFor(state, active!)).toEqual(autoPlayFor(structuredClone(state), active!))
    expect(playToEnd(SEED).state).toEqual(playToEnd(SEED).state)
  })

  it("carries the stream from one automatic play to the next: the second turn does not repeat the first", () => {
    let state = GAME.debug!.missions!(GAME.setup({ players: table, options: {}, seed: SEED }))
    const before = state.rng
    state = autoPlayFor(state, waitingFor(state)[0]!)
    expect(state.rng).not.toBe(before)
  })

  it("same seed + same actions ⇒ identical final state", () => {
    const { state: expected, actions } = playToEnd(SEED)
    expect(actions.length).toBeGreaterThan(0)
    let state = GAME.setup({ players: table, options: {}, seed: SEED })
    for (const action of actions) state = step(state, action).state
    // the stream only moves with the automatic moves, which these actions replace: it is the one thing that differs
    expect({ ...state, rng: 0 }).toEqual({ ...expected, rng: 0 })
  })

  it("does not move what the deal is when the cards' ids are drawn: the ids come from the other half of the seed", () => {
    // two seeds that differ only in their high bits deal the same hands (by kind) but under other ids
    const low = 123456789
    const a = newState(3, low)
    const b = newState(3, low + 2 ** 33)
    expect(a.ids).not.toEqual(b.ids)
    expect(a.hands.map((hand) => hand.map((id) => a.ids.indexOf(id)))).toEqual(b.hands.map((hand) => hand.map((id) => b.ids.indexOf(id))))
  })
})
