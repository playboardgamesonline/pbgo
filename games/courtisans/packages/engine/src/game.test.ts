import { describe, expect, it } from "vitest"
import { GAME } from "./game"
import { missionsTest } from "./test-utils"

const players = [
  { id: "a", nickname: "Alice" },
  { id: "b", nickname: "Bob" },
  { id: "c", nickname: "Chloé" },
]

describe("GAME (contrat @pgo/engine-kit)", () => {
  it("met en place une partie à partir des joueurs du lobby et des missions chargées", () => {
    const state = GAME.setup({ players, options: {}, seed: 42, data: missionsTest() })
    expect(state.joueurs.map((j) => [j.id, j.pseudo])).toEqual([["a", "Alice"], ["b", "Bob"], ["c", "Chloé"]])
    expect(state.joueurs.every((j) => j.missions.length === 2)).toBe(true)
    expect(GAME.isOver(state)).toBe(false)
  })

  it("est déterministe avec une graine", () => {
    const a = GAME.setup({ players, options: {}, seed: 7, data: missionsTest() })
    const b = GAME.setup({ players, options: {}, seed: 7, data: missionsTest() })
    expect(a).toEqual(b)
  })

  it("traduit playerId en joueurId pour appliquer une action", () => {
    const state = GAME.setup({ players, options: {}, seed: 1, data: missionsTest() })
    const next = GAME.apply(state, { type: "lireMissions", playerId: "b" })
    expect(next.joueurs.find((j) => j.id === "b")!.missionsLues).toBe(true)
  })

  it("mène une partie jusqu'au bout via les commandes debug", () => {
    const state = GAME.setup({ players, options: {}, seed: 3, data: missionsTest() })
    const over = GAME.debug!.over!(state)
    expect(GAME.isOver(over)).toBe(true)
    expect(GAME.view(over, "a").joueurs).toHaveLength(3)
  })
})
