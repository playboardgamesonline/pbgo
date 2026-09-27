import { poids } from "./deck"
import type { Statuts } from "./scoring"
import { FAMILLES, type Comparateur, type Condition, type Courtisan, type FiltreCartes, type GameState, type ModeComptage } from "./types"

export type ContexteMission = {
  state: GameState
  joueurIndex: number
  statuts: Statuts
}

export function comparer(a: number, comparateur: Comparateur, b: number): boolean {
  switch (comparateur) {
    case "eq":
      return a === b
    case "gte":
      return a >= b
    case "lte":
      return a <= b
    case "gt":
      return a > b
    case "lt":
      return a < b
  }
}

export function correspond(carte: Courtisan, filtre: FiltreCartes): boolean {
  if (filtre.famille && carte.famille !== filtre.famille) return false
  if (filtre.role === "sansRole") return carte.role === null
  if (filtre.role && carte.role !== filtre.role) return false
  return true
}

export function compter(cartes: Courtisan[], filtre: FiltreCartes, mode: ModeComptage = "cartes"): number {
  return cartes.filter((c) => correspond(c, filtre)).reduce((sum, c) => sum + (mode === "poids" ? poids(c) : 1), 0)
}

export function evaluerCondition(condition: Condition, ctx: ContexteMission): boolean {
  const { state, joueurIndex, statuts } = ctx
  const joueurs = state.joueurs
  const moi = joueurs[joueurIndex]!

  switch (condition.type) {
    case "statutFamille":
      return statuts[condition.famille].statut === condition.statut

    case "nombreFamillesStatut": {
      const n = FAMILLES.filter((f) => statuts[f].statut === condition.statut).length
      return comparer(n, condition.comparateur, condition.valeur)
    }

    case "nombreCartesDomaine":
      return comparer(compter(moi.domaine, condition.filtre, condition.mode), condition.comparateur, condition.valeur)

    case "nombreCartesTable": {
      const cartes = state.table.filter((p) => !condition.niveau || p.niveau === condition.niveau).map((p) => p.carte)
      return comparer(compter(cartes, condition.filtre, condition.mode), condition.comparateur, condition.valeur)
    }

    case "comparaisonJoueurs": {
      const mien = compter(moi.domaine, condition.filtre, condition.mode)
      const autre = (i: number) => compter(joueurs[(i + joueurs.length) % joueurs.length]!.domaine, condition.filtre, condition.mode)
      const adversaires = joueurs.map((_, i) => i).filter((i) => i !== joueurIndex)
      switch (condition.adversaire) {
        case "voisinGauche":
          return comparer(mien, condition.comparateur, autre(joueurIndex + 1))
        case "voisinDroite":
          return comparer(mien, condition.comparateur, autre(joueurIndex - 1))
        case "tousLesAdversaires":
          return adversaires.every((i) => comparer(mien, condition.comparateur, autre(i)))
        case "auMoinsUnAdversaire":
          return adversaires.some((i) => comparer(mien, condition.comparateur, autre(i)))
      }
    }

    case "et":
      return condition.conditions.every((c) => evaluerCondition(c, ctx))
    case "ou":
      return condition.conditions.some((c) => evaluerCondition(c, ctx))
    case "non":
      return !evaluerCondition(condition.condition, ctx)
  }
}
