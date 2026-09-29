import { describe, expect, it } from "vitest"
import { applyAction, zonesDisponibles } from "./actions"
import { type Rng, createRng } from "./rng"
import { setupPartie } from "./setup"
import { missionsTest } from "./test-utils"
import type { Cible, GameState } from "./types"
import { vueJoueur } from "./view"

function coupAleatoire(state: GameState, rng: Rng): GameState {
  const joueur = state.joueurs[state.joueurActif]!
  const carte = joueur.main[Math.floor(rng() * joueur.main.length)]!
  const zone = zonesDisponibles(state)[0]!
  const adversaires = state.joueurs.filter((j) => j.id !== joueur.id)
  const cible: Cible =
    zone === "table"
      ? { zone: "table", niveau: rng() < 0.5 ? "haut" : "bas" }
      : { zone: "domaine", joueurId: zone === "domaine" ? joueur.id : adversaires[Math.floor(rng() * adversaires.length)]!.id }

  let cibleAssassinat: string | undefined
  if (carte.role === "assassin") {
    const cartes = cible.zone === "table" ? state.table.map((p) => p.carte) : state.joueurs.find((j) => j.id === cible.joueurId)!.domaine
    cibleAssassinat = cartes.find((c) => c.role !== "garde")?.id
  }
  return applyAction(state, { type: "jouerCarte", joueurId: joueur.id, carteId: carte.id, cible, cibleAssassinat })
}

describe("simulation", () => {
  it.each([2, 3, 4, 5])("plays full random games with %i joueurs", (n) => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed * 31 + n)
      let state = setupPartie({
        joueurs: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, pseudo: `P${i}`, chateau: "c1" })),
        missions: missionsTest(),
        rng,
      })
      for (const j of state.joueurs) state = applyAction(state, { type: "lireMissions", joueurId: j.id })

      let coups = 0
      while (state.phase === "jeu") {
        state = coupAleatoire(state, rng)
        expect(++coups).toBeLessThan(200)
      }

      const total =
        state.table.length + state.eliminees.length + state.ecartees.length + state.joueurs.reduce((s, j) => s + j.domaine.length, 0)
      expect(total).toBe(90)
      expect(state.joueurs.every((j) => j.main.length === 0)).toBe(true)
      expect(vueJoueur(state, "p0").resultats?.vainqueurs.length).toBeGreaterThan(0)
    }
  })
})
