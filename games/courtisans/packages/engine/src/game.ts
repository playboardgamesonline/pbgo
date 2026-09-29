import type { GameDefinition } from "@pgo/engine-kit"
import { applyAction } from "./actions"
import { applyDebug } from "./debug"
import { createRng } from "./rng"
import { setupGame } from "./setup"
import type { Action, GameState, Mission } from "./types"
import { type PlayerView, playerView } from "./view"

/** Définition du jeu pour @pgo/core (contrat @pgo/engine-kit). `data` = missions chargées côté serveur. */
export const GAME: GameDefinition<GameState, Action, PlayerView, Mission[]> = {
  id: "courtisans",
  name: "Courtisans",
  minPlayers: 2,
  maxPlayers: 5,
  options: {},
  clientActions: ["readMissions", "playCard"],
  setup: ({ players, seed, data }) =>
    setupGame({
      players: players.map((p) => ({ id: p.id, nickname: p.nickname })),
      missions: data ?? [],
      ...(seed === undefined ? {} : { rng: createRng(seed) }),
    }),
  apply: applyAction,
  view: playerView,
  isOver: (state) => state.phase === "over",
  debug: {
    turn: (state) => applyDebug(state, "turn"),
    over: (state) => applyDebug(state, "over"),
    missions: (state) => applyDebug(state, "missions"),
  },
}
