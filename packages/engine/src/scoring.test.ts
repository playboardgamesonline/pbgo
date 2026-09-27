import { describe, expect, it } from "vitest"
import { calculerResultats, calculerStatuts } from "./scoring"
import { carte, etat, joueur, place } from "./test-utils"
import type { Mission } from "./types"

function tableDuLivret() {
  return [
    place(carte("papillon"), "haut"),
    place(carte("papillon"), "haut"),
    place(carte("papillon"), "bas"),
    place(carte("crapaud", "noble"), "haut"),
    place(carte("crapaud", "noble"), "haut"),
    place(carte("rossignol"), "haut"),
    place(carte("rossignol"), "haut"),
    place(carte("rossignol", "noble"), "bas"),
    place(carte("rossignol"), "bas"),
    place(carte("lievre", "espion"), "haut"),
    place(carte("lievre"), "bas"),
    place(carte("lievre", "noble"), "bas"),
    place(carte("cerf", "noble"), "haut"),
    place(carte("cerf"), "haut"),
    place(carte("cerf"), "bas"),
    place(carte("carpe"), "haut"),
    place(carte("carpe"), "haut"),
    place(carte("carpe"), "bas"),
    place(carte("carpe"), "bas"),
  ]
}

describe("calculerStatuts", () => {
  it("matches the rulebook example (nobles count double, spies count by famille)", () => {
    const statuts = calculerStatuts(tableDuLivret())
    expect(statuts.papillon.statut).toBe("lumiere")
    expect(statuts.crapaud).toEqual({ haut: 4, bas: 0, statut: "lumiere" })
    expect(statuts.cerf.statut).toBe("lumiere")
    expect(statuts.carpe.statut).toBe("neutre")
    expect(statuts.rossignol).toEqual({ haut: 2, bas: 3, statut: "disgrace" })
    expect(statuts.lievre.statut).toBe("disgrace")
  })
})

describe("calculerResultats", () => {
  it("gives Noëmie 11 points like in the rulebook", () => {
    const mission: Mission = {
      id: "m1",
      couleur: "blanche",
      texte: "Les lièvres doivent être en disgrâce à la cour.",
      condition: { type: "statutFamille", famille: "lievre", statut: "disgrace" },
    }
    const echec: Mission = { ...mission, id: "m2", condition: { type: "statutFamille", famille: "carpe", statut: "lumiere" } }
    const domaine = [
      carte("papillon", "noble"),
      carte("papillon"),
      carte("crapaud"),
      carte("crapaud"),
      carte("crapaud"),
      carte("rossignol", "noble"),
      carte("rossignol"),
      carte("cerf", "noble"),
      carte("cerf", "noble"),
      carte("cerf"),
      carte("carpe"),
      carte("carpe", "noble"),
    ]
    const state = etat({
      phase: "fin",
      table: tableDuLivret(),
      joueurs: [joueur("noemie", { domaine, missions: [mission, echec] }), joueur("b", { domaine: [carte("lievre")] })],
    })
    const resultats = calculerResultats(state)
    const noemie = resultats.joueurs.find((j) => j.joueurId === "noemie")!
    expect(noemie.pointsDomaine).toBe(8)
    expect(noemie.missions).toEqual([
      { missionId: "m1", validee: true, points: 3 },
      { missionId: "m2", validee: false, points: 0 },
    ])
    expect(noemie.total).toBe(11)
    expect(resultats.vainqueurs).toEqual(["noemie"])
    expect(resultats.joueurs[1]).toMatchObject({ joueurId: "b", total: -1, rang: 2 })
  })

  it("shares the victory on a tie", () => {
    const state = etat({ phase: "fin", joueurs: [joueur("a"), joueur("b"), joueur("c", { domaine: [carte("cerf")] })], table: [place(carte("cerf"), "bas")] })
    const resultats = calculerResultats(state)
    expect(resultats.vainqueurs.sort()).toEqual(["a", "b"])
    expect(resultats.joueurs.map((j) => j.rang)).toEqual([1, 1, 3])
  })
})
