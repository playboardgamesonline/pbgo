import type { GameDefinition, PlayerAction } from "@pgo/engine-kit"
import { applyAction } from "./actions"
import { appliquerDebug } from "./debug"
import { createRng } from "./rng"
import { setupPartie } from "./setup"
import type { Action, Cible, GameState, Mission } from "./types"
import { type VueJoueur, vueJoueur } from "./view"

/** Actions telles qu'envoyées par @pgo/core : l'identité du joueur arrive dans `playerId` (posé par le serveur). */
export type CoreAction =
  | { type: "lireMissions"; playerId: string }
  | { type: "jouerCarte"; playerId: string; carteId: string; cible: Cible; cibleAssassinat?: string }

/** Adaptateur du moteur Courtisans au contrat @pgo/engine-kit (utilisé par @pgo/core). */
export const GAME: GameDefinition<GameState, CoreAction & PlayerAction, VueJoueur, Mission[]> = {
  id: "courtisans",
  name: "Courtisans",
  minPlayers: 2,
  maxPlayers: 5,
  options: {},
  clientActions: ["lireMissions", "jouerCarte"],
  setup: ({ players, seed, data }) =>
    setupPartie({
      joueurs: players.map((p) => ({ id: p.id, pseudo: p.nickname, chateau: "" })),
      missions: data ?? [],
      ...(seed === undefined ? {} : { rng: createRng(seed) }),
    }),
  apply: (state, { playerId, ...action }) => applyAction(state, { ...action, joueurId: playerId } as Action),
  view: vueJoueur,
  isOver: (state) => state.phase === "fin",
  debug: {
    turn: (state) => appliquerDebug(state, "tour"),
    over: (state) => appliquerDebug(state, "fin"),
  },
}
