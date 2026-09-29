import { describe, expect, it } from "vitest"
import { applyAction } from "./actions"
import { carte, etat, joueur } from "./test-utils"
import { vueJoueur } from "./view"

describe("vueJoueur", () => {
  const espion = carte("lievre", "espion")
  const state = etat({
    joueurs: [joueur("a", { main: [espion, carte("cerf"), carte("cerf")] }), joueur("b", { main: [carte("carpe")] })],
    pioche: [carte("crapaud")],
  })
  const apres = applyAction(state, { type: "jouerCarte", joueurId: "a", carteId: espion.id, cible: { zone: "table", niveau: "haut" } })

  it("only exposes the viewer's own main and missions", () => {
    const vue = vueJoueur(apres, "a")
    expect(vue.moi?.main).toHaveLength(2)
    expect(vue.joueurs[1]).toMatchObject({ nombreCartesMain: 1, missions: null })
    expect(JSON.stringify(vue)).not.toContain("carpe")
    expect(vue.nombreCartesPioche).toBe(1)
  })

  it("hides the famille of played espions, even from their owner and in the journal", () => {
    const vue = vueJoueur(apres, "a")
    expect(vue.table[0]!.carte).toEqual({ id: espion.id, famille: null, role: "espion" })
    expect(vue.journal[0]).toMatchObject({ type: "carteJouee", carte: { famille: null, role: "espion" } })
  })

  it("reveals everything at the end with resultats", () => {
    const vue = vueJoueur({ ...apres, phase: "fin" }, "b")
    expect(vue.table[0]!.carte.famille).toBe("lievre")
    expect(vue.resultats?.joueurs).toHaveLength(2)
    expect(vue.joueurs[0]!.missions).toEqual([])
  })

  it("lists the zones still available this turn", () => {
    expect(vueJoueur(apres, "a").zonesDisponibles).toEqual(["domaine", "domaineAdverse"])
  })
})
