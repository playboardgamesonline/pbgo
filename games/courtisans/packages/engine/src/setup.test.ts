import { describe, expect, it } from "vitest"
import { createCourtiers } from "./deck"
import { createRng } from "./rng"
import { setupGame } from "./setup"
import { testMissions } from "./test-utils"

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `P${i}` }))

describe("createCourtiers", () => {
  it("builds 90 cards, 15 per family with the right roles", () => {
    const cards = createCourtiers()
    expect(cards).toHaveLength(90)
    expect(new Set(cards.map((c) => c.id)).size).toBe(90)
    const hares = cards.filter((c) => c.family === "hare")
    expect(hares).toHaveLength(15)
    expect(hares.filter((c) => c.role === "noble")).toHaveLength(4)
    expect(hares.filter((c) => c.role === "spy")).toHaveLength(2)
    expect(hares.filter((c) => c.role === "assassin")).toHaveLength(2)
    expect(hares.filter((c) => c.role === "guard")).toHaveLength(3)
    expect(hares.filter((c) => c.role === null)).toHaveLength(4)
  })
})

describe("setupGame", () => {
  it.each([
    [2, 30],
    [3, 18],
    [4, 6],
    [5, 0],
  ])("with %i players sets aside %i cards", (n, setAside) => {
    const state = setupGame({ players: players(n), missions: testMissions(), rng: createRng(1) })
    expect(state.setAside).toHaveLength(setAside)
    expect(state.deck).toHaveLength(90 - setAside - 3 * n)
    for (const j of state.players) {
      expect(j.hand).toHaveLength(3)
      expect(j.missions.map((m) => m.color).sort()).toEqual(["blue", "white"])
    }
    expect(state.phase).toBe("missions")
    expect(state.players.every((j) => !j.missionsRead)).toBe(true)
    expect(state.activePlayer).toBeGreaterThanOrEqual(0)
    expect(state.activePlayer).toBeLessThan(n)
  })

  it("rejects invalid player counts", () => {
    expect(() => setupGame({ players: players(1), missions: testMissions() })).toThrow()
    expect(() => setupGame({ players: players(6), missions: testMissions() })).toThrow()
  })
})
