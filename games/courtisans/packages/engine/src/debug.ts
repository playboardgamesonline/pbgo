import { applyAction, zonesDisponibles } from "./actions"
import type { Cible, GameState } from "./types"

export type CommandeDebug = "missions" | "tour" | "fin"

const hasard = <T>(liste: T[]) => liste[Math.floor(Math.random() * liste.length)]!

export function coupAutomatique(state: GameState): GameState {
  const joueur = state.joueurs[state.joueurActif]!
  const carte = hasard(joueur.main)
  const zone = zonesDisponibles(state)[0]!
  const adversaires = state.joueurs.filter((j) => j.id !== joueur.id)
  const cible: Cible =
    zone === "table"
      ? { zone: "table", niveau: Math.random() < 0.5 ? "haut" : "bas" }
      : { zone: "domaine", joueurId: zone === "domaine" ? joueur.id : hasard(adversaires).id }
  let cibleAssassinat: string | undefined
  if (carte.role === "assassin") {
    const cartes = cible.zone === "table" ? state.table.map((p) => p.carte) : state.joueurs.find((j) => j.id === cible.joueurId)!.domaine
    cibleAssassinat = cartes.find((c) => c.role !== "garde")?.id
  }
  return applyAction(state, { type: "jouerCarte", joueurId: joueur.id, carteId: carte.id, cible, cibleAssassinat })
}

function lireToutes(state: GameState): GameState {
  let s = state
  for (const j of s.joueurs) if (!j.missionsLues) s = applyAction(s, { type: "lireMissions", joueurId: j.id })
  return s
}

export function appliquerDebug(state: GameState, commande: CommandeDebug): GameState {
  let s = state.phase === "missions" ? lireToutes(state) : state
  if (commande === "tour" && s.phase === "jeu") {
    const tour = s.numeroTour
    for (let i = 0; i < 3 && s.phase === "jeu" && s.numeroTour === tour; i++) s = coupAutomatique(s)
  }
  if (commande === "fin") for (let i = 0; i < 400 && s.phase === "jeu"; i++) s = coupAutomatique(s)
  return s
}
