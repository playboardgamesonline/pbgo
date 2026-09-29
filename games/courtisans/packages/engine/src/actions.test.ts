import { describe, expect, it } from "vitest"
import { applyAction } from "./actions"
import { createRng } from "./rng"
import { setupPartie } from "./setup"
import { carte, etat, joueur, missionsTest, place } from "./test-utils"
import type { GameState } from "./types"

describe("lireMissions", () => {
  it("does not block the game: play starts right away and reading only sets a flag", () => {
    let state = setupPartie({
      joueurs: [
        { id: "a", pseudo: "A", chateau: "c1" },
        { id: "b", pseudo: "B", chateau: "c2" },
      ],
      missions: missionsTest(),
      rng: createRng(3),
    })
    expect(state.phase).toBe("jeu")
    state = applyAction(state, { type: "lireMissions", joueurId: "a" })
    expect(state.phase).toBe("jeu")
    expect(state.joueurs[0]!.missionsLues).toBe(true)
  })
})

function partieSimple(): GameState {
  const main = [carte("lievre", "garde"), carte("cerf"), carte("carpe", "noble")]
  return etat({
    joueurs: [joueur("a", { main }), joueur("b", { main: [carte("papillon"), carte("papillon"), carte("papillon")] })],
    pioche: [carte("crapaud"), carte("crapaud"), carte("crapaud")],
  })
}

describe("jouerCarte", () => {
  it("plays one card per zone then draws and passes the turn", () => {
    let state = partieSimple()
    const [c1, c2, c3] = state.joueurs[0]!.main
    state = applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: c1!.id, cible: { zone: "table", niveau: "haut" } })
    state = applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: c2!.id, cible: { zone: "domaine", joueurId: "a" } })
    expect(state.zonesJouees).toEqual(["table", "domaine"])
    state = applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: c3!.id, cible: { zone: "domaine", joueurId: "b" } })

    expect(state.table).toHaveLength(1)
    expect(state.joueurs[0]!.domaine).toHaveLength(1)
    expect(state.joueurs[1]!.domaine).toHaveLength(1)
    expect(state.joueurs[0]!.main).toHaveLength(3)
    expect(state.pioche).toHaveLength(0)
    expect(state.joueurActif).toBe(1)
    expect(state.zonesJouees).toEqual([])
    expect(state.journal.map((e) => e.type)).toEqual(["carteJouee", "carteJouee", "carteJouee", "pioche"])
  })

  it("refuses a second card in the same zone", () => {
    let state = partieSimple()
    const [c1, c2] = state.joueurs[0]!.main
    state = applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: c1!.id, cible: { zone: "table", niveau: "haut" } })
    expect(() =>
      applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: c2!.id, cible: { zone: "table", niveau: "bas" } }),
    ).toThrow("ZONE_DEJA_JOUEE")
  })

  it("refuses to play out of turn or an unknown card", () => {
    const state = partieSimple()
    const cb = state.joueurs[1]!.main[0]!
    expect(() => applyAction(state, { type: "jouerCarte", joueurId: "b", carteId: cb.id, cible: { zone: "table", niveau: "haut" } })).toThrow(
      "PAS_TON_TOUR",
    )
    expect(() => applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: "nope", cible: { zone: "table", niveau: "haut" } })).toThrow(
      "CARTE_INCONNUE",
    )
  })

  it("does not mutate the previous state", () => {
    const state = partieSimple()
    const c = state.joueurs[0]!.main[0]!
    applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: c.id, cible: { zone: "table", niveau: "haut" } })
    expect(state.joueurs[0]!.main).toHaveLength(3)
    expect(state.table).toHaveLength(0)
  })
})

describe("assassin", () => {
  it("eliminates any card at the table, spies included", () => {
    const assassin = carte("rossignol", "assassin")
    const espion = carte("lievre", "espion")
    const state = etat({
      joueurs: [joueur("a", { main: [assassin, carte("cerf"), carte("cerf")] }), joueur("b")],
      table: [place(espion, "haut")],
    })
    const next = applyAction(state, {
      type: "jouerCarte",
      joueurId: "a",
      carteId: assassin.id,
      cible: { zone: "table", niveau: "bas" },
      cibleAssassinat: espion.id,
    })
    expect(next.table.map((p) => p.carte.id)).toEqual([assassin.id])
    expect(next.eliminees.map((c) => c.id)).toEqual([espion.id])
    expect(next.journal.at(-1)).toMatchObject({ type: "carteEliminee", cible: { zone: "table", niveau: "haut" } })
  })

  it("only targets cards in the same domaine", () => {
    const assassin = carte("rossignol", "assassin")
    const victime = carte("cerf", "noble")
    const state = etat({
      joueurs: [joueur("a", { main: [assassin, carte("cerf"), carte("cerf")], domaine: [victime] }), joueur("b")],
    })
    expect(() =>
      applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: assassin.id, cible: { zone: "domaine", joueurId: "b" }, cibleAssassinat: victime.id }),
    ).toThrow("ASSASSINAT_INVALIDE")
    const next = applyAction(state, {
      type: "jouerCarte",
      joueurId: "a",
      carteId: assassin.id,
      cible: { zone: "domaine", joueurId: "a" },
      cibleAssassinat: victime.id,
    })
    expect(next.joueurs[0]!.domaine.map((c) => c.id)).toEqual([assassin.id])
  })

  it("cannot eliminate a garde nor act for a non-assassin", () => {
    const assassin = carte("rossignol", "assassin")
    const garde = carte("cerf", "garde")
    const simple = carte("carpe")
    const state = etat({
      joueurs: [joueur("a", { main: [assassin, simple, carte("cerf")] }), joueur("b")],
      table: [place(garde, "haut")],
    })
    expect(() =>
      applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: assassin.id, cible: { zone: "table", niveau: "haut" }, cibleAssassinat: garde.id }),
    ).toThrow("ASSASSINAT_INVALIDE")
    expect(() =>
      applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: simple.id, cible: { zone: "table", niveau: "haut" }, cibleAssassinat: garde.id }),
    ).toThrow("ASSASSINAT_INVALIDE")
  })

  it("is optional", () => {
    const assassin = carte("rossignol", "assassin")
    const state = etat({ joueurs: [joueur("a", { main: [assassin, carte("cerf"), carte("cerf")] }), joueur("b")], table: [place(carte("cerf"), "haut")] })
    const next = applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: assassin.id, cible: { zone: "table", niveau: "haut" } })
    expect(next.table).toHaveLength(2)
  })
})

describe("fin de partie", () => {
  it("ends when the pioche is empty and every main is empty", () => {
    const a = [carte("cerf"), carte("cerf"), carte("cerf")]
    const b = [carte("carpe"), carte("carpe"), carte("carpe")]
    let state = etat({ joueurs: [joueur("a", { main: a }), joueur("b", { main: b })] })
    const cibles = (moi: string, autre: string) => [
      { zone: "table" as const, niveau: "haut" as const },
      { zone: "domaine" as const, joueurId: moi },
      { zone: "domaine" as const, joueurId: autre },
    ]
    a.forEach((c, i) => (state = applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: c.id, cible: cibles("a", "b")[i]! })))
    expect(state.phase).toBe("jeu")
    expect(state.joueurActif).toBe(1)
    b.forEach((c, i) => (state = applyAction(state, { type: "jouerCarte", joueurId: "b", carteId: c.id, cible: cibles("b", "a")[i]! })))
    expect(state.phase).toBe("fin")
    expect(state.journal.at(-1)).toEqual({ type: "finDePartie" })
  })
})
