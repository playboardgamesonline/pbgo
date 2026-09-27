import { POINTS_MISSION, poids } from "./deck"
import { evaluerCondition } from "./missions"
import { FAMILLES, type Courtisan, type Famille, type GameState, type Placement, type Statut } from "./types"

export type StatutFamille = { haut: number; bas: number; statut: Statut }
export type Statuts = Record<Famille, StatutFamille>

export type DetailFamille = { famille: Famille; poids: number; points: number }

export type ResultatJoueur = {
  joueurId: string
  pointsDomaine: number
  detail: DetailFamille[]
  missions: { missionId: string; validee: boolean; points: number }[]
  total: number
  rang: number
}

export type Resultats = {
  statuts: Statuts
  joueurs: ResultatJoueur[]
  vainqueurs: string[]
}

export function calculerStatuts(table: Placement[]): Statuts {
  const statuts = Object.fromEntries(FAMILLES.map((f) => [f, { haut: 0, bas: 0, statut: "neutre" }])) as Statuts
  for (const { carte, niveau } of table) statuts[carte.famille][niveau] += poids(carte)
  for (const s of Object.values(statuts)) {
    s.statut = s.haut > s.bas ? "lumiere" : s.bas > s.haut ? "disgrace" : "neutre"
  }
  return statuts
}

export function valeurStatut(statut: Statut): number {
  return statut === "lumiere" ? 1 : statut === "disgrace" ? -1 : 0
}

export function pointsDomaine(domaine: Courtisan[], statuts: Statuts): { total: number; detail: DetailFamille[] } {
  const detail = FAMILLES.map((famille) => {
    const p = domaine.filter((c) => c.famille === famille).reduce((sum, c) => sum + poids(c), 0)
    return { famille, poids: p, points: p * valeurStatut(statuts[famille].statut) }
  }).filter((d) => d.poids > 0)
  return { total: detail.reduce((sum, d) => sum + d.points, 0), detail }
}

export function calculerResultats(state: GameState): Resultats {
  const statuts = calculerStatuts(state.table)
  const joueurs = state.joueurs.map((joueur, index) => {
    const domaine = pointsDomaine(joueur.domaine, statuts)
    const missions = joueur.missions.map((m) => {
      const validee = evaluerCondition(m.condition, { state, joueurIndex: index, statuts })
      return { missionId: m.id, validee, points: validee ? POINTS_MISSION : 0 }
    })
    const total = domaine.total + missions.reduce((sum, m) => sum + m.points, 0)
    return { joueurId: joueur.id, pointsDomaine: domaine.total, detail: domaine.detail, missions, total, rang: 0 }
  })

  joueurs.sort((a, b) => b.total - a.total)
  for (const j of joueurs) j.rang = 1 + joueurs.filter((o) => o.total > j.total).length

  const meilleur = joueurs[0]?.total
  return { statuts, joueurs, vainqueurs: joueurs.filter((j) => j.total === meilleur).map((j) => j.joueurId) }
}
