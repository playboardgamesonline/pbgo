import { joueurActifId, zonesDisponibles } from "./actions"
import { type Resultats, calculerResultats } from "./scoring"
import type { Cible, Courtisan, Famille, GameState, Mission, Niveau, Phase, Role, ZoneJeu } from "./types"

export type CarteVisible = {
  id: string
  famille: Famille | null
  role: Role | null
}

export type EvenementVisible =
  | { type: "carteJouee"; joueurId: string; carte: CarteVisible; cible: Cible }
  | { type: "carteEliminee"; joueurId: string; carte: CarteVisible; cible: Cible }
  | { type: "pioche"; joueurId: string; nombre: number }
  | { type: "finDePartie" }

export type JoueurVisible = {
  id: string
  pseudo: string
  chateau: string
  domaine: CarteVisible[]
  nombreCartesMain: number
  missionsLues: boolean
  missions: Mission[] | null
}

export type VueJoueur = {
  moi: { id: string; main: Courtisan[]; missions: Mission[] } | null
  joueurs: JoueurVisible[]
  table: { carte: CarteVisible; niveau: Niveau }[]
  nombreCartesPioche: number
  joueurActifId: string | null
  premierJoueurId: string | null
  zonesDisponibles: ZoneJeu[]
  numeroTour: number
  phase: Phase
  journal: EvenementVisible[]
  resultats: Resultats | null
}

export function carteVisible(carte: Courtisan, revele: boolean): CarteVisible {
  if (carte.role === "espion" && !revele) return { id: carte.id, famille: null, role: "espion" }
  return { id: carte.id, famille: carte.famille, role: carte.role }
}

export function vueJoueur(state: GameState, joueurId: string | null): VueJoueur {
  const fin = state.phase === "fin"
  const moi = state.joueurs.find((j) => j.id === joueurId)

  return {
    moi: moi ? { id: moi.id, main: moi.main, missions: moi.missions } : null,
    joueurs: state.joueurs.map((j) => ({
      id: j.id,
      pseudo: j.pseudo,
      chateau: j.chateau,
      domaine: j.domaine.map((c) => carteVisible(c, fin)),
      nombreCartesMain: j.main.length,
      missionsLues: j.missionsLues,
      missions: fin ? j.missions : null,
    })),
    table: state.table.map(({ carte, niveau }) => ({ carte: carteVisible(carte, fin), niveau })),
    nombreCartesPioche: state.pioche.length,
    joueurActifId: joueurActifId(state),
    premierJoueurId: state.joueurs[state.joueurActif]?.id ?? null,
    zonesDisponibles: zonesDisponibles(state),
    numeroTour: state.numeroTour,
    phase: state.phase,
    journal: state.journal.map((e) =>
      e.type === "carteJouee" || e.type === "carteEliminee" ? { ...e, carte: carteVisible(e.carte, fin) } : e,
    ),
    resultats: fin ? calculerResultats(state) : null,
  }
}
