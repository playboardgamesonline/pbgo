import { describe, expect, it } from "vitest"
import { evaluerCondition } from "./missions"
import { calculerStatuts } from "./scoring"
import { carte, etat, joueur, place } from "./test-utils"
import type { Condition, GameState } from "./types"

function contexte(state: GameState, joueurIndex = 0) {
  return { state, joueurIndex, statuts: calculerStatuts(state.table) }
}

const state = etat({
  table: [place(carte("lievre"), "bas"), place(carte("rossignol"), "bas"), place(carte("cerf"), "haut")],
  joueurs: [
    joueur("a", { domaine: [carte("papillon"), carte("cerf", "noble"), carte("cerf", "assassin")] }),
    joueur("b", { domaine: [carte("papillon"), carte("papillon")] }),
    joueur("c", { domaine: [] }),
  ],
})

describe("evaluerCondition", () => {
  const cas: [string, Condition, boolean][] = [
    ["statutFamille", { type: "statutFamille", famille: "lievre", statut: "disgrace" }, true],
    ["nombreFamillesStatut", { type: "nombreFamillesStatut", statut: "disgrace", comparateur: "gte", valeur: 2 }, true],
    ["nombreFamillesStatut neutre", { type: "nombreFamillesStatut", statut: "neutre", comparateur: "eq", valeur: 3 }, true],
    ["domaine cartes", { type: "nombreCartesDomaine", filtre: { famille: "cerf" }, comparateur: "eq", valeur: 2 }, true],
    ["domaine poids", { type: "nombreCartesDomaine", filtre: { famille: "cerf" }, comparateur: "eq", valeur: 3, mode: "poids" }, true],
    ["domaine role", { type: "nombreCartesDomaine", filtre: { role: "assassin" }, comparateur: "gte", valeur: 1 }, true],
    ["domaine sans role", { type: "nombreCartesDomaine", filtre: { role: "sansRole" }, comparateur: "eq", valeur: 1 }, true],
    ["table niveau", { type: "nombreCartesTable", filtre: {}, niveau: "bas", comparateur: "eq", valeur: 2 }, true],
    ["moins de papillons que voisin de gauche", { type: "comparaisonJoueurs", filtre: { famille: "papillon" }, comparateur: "lt", adversaire: "voisinGauche" }, true],
    ["moins de papillons que voisin de droite", { type: "comparaisonJoueurs", filtre: { famille: "papillon" }, comparateur: "lt", adversaire: "voisinDroite" }, false],
    ["plus de cartes que tous", { type: "comparaisonJoueurs", filtre: {}, comparateur: "gt", adversaire: "tousLesAdversaires" }, true],
    ["au moins un adversaire", { type: "comparaisonJoueurs", filtre: { famille: "papillon" }, comparateur: "gt", adversaire: "auMoinsUnAdversaire" }, true],
    [
      "et",
      { type: "et", conditions: [{ type: "statutFamille", famille: "cerf", statut: "lumiere" }, { type: "statutFamille", famille: "carpe", statut: "lumiere" }] },
      false,
    ],
    [
      "ou",
      { type: "ou", conditions: [{ type: "statutFamille", famille: "cerf", statut: "lumiere" }, { type: "statutFamille", famille: "carpe", statut: "lumiere" }] },
      true,
    ],
    ["non", { type: "non", condition: { type: "statutFamille", famille: "carpe", statut: "lumiere" } }, true],
  ]

  it.each(cas)("%s", (_, condition, attendu) => {
    expect(evaluerCondition(condition, contexte(state))).toBe(attendu)
  })
})
