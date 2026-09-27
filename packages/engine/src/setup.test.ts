import { describe, expect, it } from "vitest"
import { creerCourtisans } from "./deck"
import { createRng } from "./rng"
import { setupPartie } from "./setup"
import { missionsTest } from "./test-utils"

const joueurs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, pseudo: `P${i}`, chateau: "c1" }))

describe("creerCourtisans", () => {
  it("builds 90 cards, 15 per famille with the right roles", () => {
    const cartes = creerCourtisans()
    expect(cartes).toHaveLength(90)
    expect(new Set(cartes.map((c) => c.id)).size).toBe(90)
    const lievres = cartes.filter((c) => c.famille === "lievre")
    expect(lievres).toHaveLength(15)
    expect(lievres.filter((c) => c.role === "noble")).toHaveLength(4)
    expect(lievres.filter((c) => c.role === "espion")).toHaveLength(2)
    expect(lievres.filter((c) => c.role === "assassin")).toHaveLength(2)
    expect(lievres.filter((c) => c.role === "garde")).toHaveLength(3)
    expect(lievres.filter((c) => c.role === null)).toHaveLength(4)
  })
})

describe("setupPartie", () => {
  it.each([
    [2, 30],
    [3, 18],
    [4, 6],
    [5, 0],
  ])("with %i joueurs discards %i cards", (n, ecartees) => {
    const state = setupPartie({ joueurs: joueurs(n), missions: missionsTest(), rng: createRng(1) })
    expect(state.ecartees).toHaveLength(ecartees)
    expect(state.pioche).toHaveLength(90 - ecartees - 3 * n)
    for (const j of state.joueurs) {
      expect(j.main).toHaveLength(3)
      expect(j.missions.map((m) => m.couleur).sort()).toEqual(["blanche", "bleue"])
    }
    expect(state.phase).toBe("missions")
    expect(state.joueurActif).toBeGreaterThanOrEqual(0)
    expect(state.joueurActif).toBeLessThan(n)
  })

  it("rejects invalid player counts", () => {
    expect(() => setupPartie({ joueurs: joueurs(1), missions: missionsTest() })).toThrow()
    expect(() => setupPartie({ joueurs: joueurs(6), missions: missionsTest() })).toThrow()
  })
})
