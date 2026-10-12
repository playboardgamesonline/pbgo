import type { GameDefinition } from "@pbgo/engine-kit"
import { activePlayerId, applyAction } from "./actions"
import { applyDebug } from "./debug"
import { setupGame } from "./setup"
import type { Action, GameState, Mission } from "./types"
import { type PlayerView, playerView } from "./view"

/** Game definition for @pbgo/core (@pbgo/engine-kit contract). `data` = missions loaded server side. */
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
      // without a seed (older servers), setupGame draws one: the game stays deterministic from then on
      seed,
    }),
  apply: applyAction,
  view: playerView,
  isOver: (state) => state.phase === "over",
  activePlayer: activePlayerId,
  // absent player: their whole turn is played (up to 3 cards)
  autoPlay: (state) => applyDebug(state, "turn"),
  debug: {
    turn: (state) => applyDebug(state, "turn"),
    over: (state) => applyDebug(state, "over"),
    missions: (state) => applyDebug(state, "missions"),
  },
}
