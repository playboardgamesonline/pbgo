import { CARTES_ECARTEES, TAILLE_MAIN, creerCourtisans } from "./deck"
import { EngineError } from "./errors"
import { type Rng, shuffle } from "./rng"
import type { Courtisan, GameState, JoueurInfo, Mission } from "./types"

export type SetupOptions = {
  joueurs: JoueurInfo[]
  missions: Mission[]
  rng?: Rng
  courtisans?: Courtisan[]
}

export function setupPartie({ joueurs, missions, rng = Math.random, courtisans = creerCourtisans() }: SetupOptions): GameState {
  const nombre = joueurs.length
  const aEcarter = CARTES_ECARTEES[nombre]
  if (aEcarter === undefined) throw new EngineError("JOUEURS_INVALIDES", "2 à 5 joueurs")
  if (new Set(joueurs.map((j) => j.id)).size !== nombre) throw new EngineError("JOUEURS_INVALIDES", "ids dupliqués")

  const blanches = shuffle(missions.filter((m) => m.couleur === "blanche"), rng)
  const bleues = shuffle(missions.filter((m) => m.couleur === "bleue"), rng)
  if (blanches.length < nombre || bleues.length < nombre) throw new EngineError("MISSIONS_INSUFFISANTES")

  const melange = shuffle(courtisans, rng)
  const ecartees = melange.splice(0, aEcarter)

  return {
    joueurs: joueurs.map((joueur, i) => ({
      ...joueur,
      main: melange.splice(0, TAILLE_MAIN),
      domaine: [],
      missions: [blanches[i] as Mission, bleues[i] as Mission],
      missionsLues: false,
    })),
    pioche: melange,
    ecartees,
    eliminees: [],
    table: [],
    joueurActif: Math.floor(rng() * nombre),
    zonesJouees: [],
    numeroTour: 1,
    phase: "jeu",
    journal: [],
  }
}
