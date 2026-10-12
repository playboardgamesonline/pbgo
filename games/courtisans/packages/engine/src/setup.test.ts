import { createRng } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { createCourtiers } from "./deck"
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

  it("gives every card a unique opaque id, stable for a given seed", () => {
    const state = setupGame({ players: players(5), missions: testMissions(), seed: 2 ** 33 + 5 })
    const cards = [...state.deck, ...state.setAside, ...state.players.flatMap((j) => j.hand)]
    expect(new Set(cards.map((c) => c.id)).size).toBe(90)
    for (const c of cards) expect(c.id).toMatch(/^c[0-9a-z]{6}$/)
    expect(setupGame({ players: players(5), missions: testMissions(), seed: 2 ** 33 + 5 })).toEqual(state)
  })

  it("keeps the deal and the ids a seed has always given (pinned before the kit's helpers took over)", () => {
    const state = setupGame({ players: players(5), missions: testMissions(), seed: 2 ** 33 + 5 })
    expect(state.players.map((j) => j.hand.map((c) => c.id))).toEqual([
      ["ccezkce", "cjcgncg", "co6djcu"],
      ["cw37s9w", "ccge9vu", "cosf4v1"],
      ["celzpd8", "ccb4w2x", "clq54j1"],
      ["cvqgcto", "cubdukn", "c52ix66"],
      ["ck0lhuh", "cap91cr", "cvymkyq"],
    ])
    expect(state.deck.slice(0, 3).map((c) => c.id)).toEqual(["cywoqmz", "cz55q6q", "cfcyxim"])
    expect(state.deck.at(-1)?.id).toBe("c6nh4mz")
    expect(state.activePlayer).toBe(2)

    const two = setupGame({ players: players(2), missions: testMissions(), seed: 7 * 2 ** 32 + 99 })
    expect(two.setAside.slice(0, 3).map((c) => c.id)).toEqual(["cz5nb7d", "cu63hgq", "ca98wdh"])
    expect(two.players.map((j) => j.hand.map((c) => c.id))).toEqual([
      ["c3p6tk5", "cd9pkgh", "conyht0"],
      ["cbi769y", "cu2shnj", "ccgzqmv"],
    ])
  })

  it("rejects invalid player counts", () => {
    expect(() => setupGame({ players: players(1), missions: testMissions() })).toThrow()
    expect(() => setupGame({ players: players(6), missions: testMissions() })).toThrow()
  })
})
