import { afterEach, describe, expect, it, vi } from "vitest"
import { autoMove } from "./debug"
import { GAME } from "./game"
import { setupGame } from "./setup"
import { testMissions } from "./test-utils"
import type { Action, GameState } from "./types"

const players = [
  { id: "a", nickname: "Alice" },
  { id: "b", nickname: "Bob" },
  { id: "c", nickname: "Chloé" },
]
const SEED = 2 ** 40 + 12345

/** Plays a whole game with `autoPlay`, recording the actions it took (rebuilt from the log). */
function playToEnd(seed: number) {
  let state = GAME.debug!.missions!(GAME.setup({ players, options: {}, seed, data: testMissions() }))
  const actions: Action[] = []
  while (!GAME.isOver(state)) {
    const before = state.log.length
    state = GAME.autoPlay!(state)
    state.log.forEach((e, i) => {
      if (i < before || e.type !== "cardPlayed") return
      // an assassination is logged right after the assassin is played
      const next = state.log[i + 1]
      const victimId = next?.type === "cardEliminated" ? next.card.id : undefined
      actions.push({ type: "playCard", playerId: e.playerId, cardId: e.card.id, target: e.target, ...(victimId ? { victimId } : {}) })
    })
  }
  return { state, actions }
}

describe("determinism (GAM-5)", () => {
  afterEach(() => vi.restoreAllMocks())

  it("sets up the same game from the same seed, and another one from another seed", () => {
    const setup = (seed: number) => GAME.setup({ players, options: {}, seed, data: testMissions() })
    expect(setup(SEED)).toEqual(setup(SEED))
    expect(setup(SEED).deck).not.toEqual(setup(SEED + 1).deck)
    expect(setup(SEED).seed).toBe(SEED)
  })

  it("never calls Math.random once a seed is given (setup, autoPlay, debug)", () => {
    const random = vi.spyOn(Math, "random")
    const state = GAME.setup({ players, options: {}, seed: SEED, data: testMissions() })
    GAME.debug!.over!(GAME.autoPlay!(state))
    expect(random).not.toHaveBeenCalled()
  })

  it("autoPlay picks the same moves for the same state", () => {
    const state = GAME.debug!.missions!(GAME.setup({ players, options: {}, seed: SEED, data: testMissions() }))
    expect(GAME.autoPlay!(state)).toEqual(GAME.autoPlay!(structuredClone(state)))
    expect(playToEnd(SEED).state).toEqual(playToEnd(SEED).state)
  })

  it("same seed + same actions ⇒ identical final state", () => {
    const { state: expected, actions } = playToEnd(SEED)
    expect(actions.length).toBeGreaterThan(0)
    let state = GAME.debug!.missions!(GAME.setup({ players, options: {}, seed: SEED, data: testMissions() }))
    for (const action of actions) state = GAME.apply(state, action)
    expect(state).toEqual(expected)
  })

  it("keeps games saved before seeds existed playable and deterministic", () => {
    const legacy = (): GameState => {
      const state = setupGame({ players, missions: testMissions(), seed: 9 })
      delete state.seed
      return GAME.debug!.missions!(state)
    }
    expect(GAME.autoPlay!(legacy())).toEqual(GAME.autoPlay!(legacy()))
    let state = legacy()
    for (let i = 0; i < 200 && !GAME.isOver(state); i++) state = autoMove(state)
    expect(GAME.isOver(state)).toBe(true)
    expect(state.seed).toBeUndefined()
  })
})
