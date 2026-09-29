import type { Courtisan, Famille, GameState, Joueur, Mission, Placement, Role } from "./types"

let seq = 0
export function carte(famille: Famille, role: Role | null = null): Courtisan {
  return { id: `t-${famille}-${role ?? "c"}-${++seq}`, famille, role }
}

export function place(c: Courtisan, niveau: "haut" | "bas"): Placement {
  return { carte: c, niveau }
}

export function joueur(id: string, patch: Partial<Joueur> = {}): Joueur {
  return { id, pseudo: id, chateau: "c1", main: [], domaine: [], missions: [], missionsLues: true, ...patch }
}

export function etat(patch: Partial<GameState>): GameState {
  return {
    joueurs: [],
    pioche: [],
    ecartees: [],
    eliminees: [],
    table: [],
    joueurActif: 0,
    zonesJouees: [],
    numeroTour: 1,
    phase: "jeu",
    journal: [],
    ...patch,
  }
}

export function missionsTest(): Mission[] {
  return Array.from({ length: 10 }, (_, i) => [
    { id: `w${i}`, couleur: "blanche" as const, texte: "", condition: { type: "statutFamille" as const, famille: "lievre" as const, statut: "disgrace" as const } },
    { id: `b${i}`, couleur: "bleue" as const, texte: "", condition: { type: "nombreFamillesStatut" as const, statut: "disgrace" as const, comparateur: "gte" as const, valeur: 2 } },
  ]).flat()
}
