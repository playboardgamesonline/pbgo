import type { GameDefinition } from "@pbgo/engine-kit"
import { step } from "./actions"
import { autoPlayFor } from "./autoplay"
import { debugCommands } from "./debug"
import { isOver, waitingFor } from "./machine"
import { OPTIONS } from "./options"
import { MAX_PLAYERS, MIN_PLAYERS, setupGame } from "./setup"
import { type Action, CLIENT_ACTIONS, type PlayerView, type State } from "./types"
import { playerView } from "./view"

/** The game for @pbgo/core (the `@pbgo/engine-kit` contract). */
export const GAME: GameDefinition<State, Action, PlayerView> = {
  id: "flip-7",
  name: "Flip 7",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  options: OPTIONS,
  clientActions: CLIENT_ACTIONS,
  setup: ({ players, options, seed }) => setupGame({ players, options, seed }),
  apply: (state, action) => step(state, action).state,
  view: (state, playerId) => playerView(state, playerId),
  isOver,
  // The player of the turn, the holder of an action card, or the next dealer between two rounds: always one player
  waitingFor,
  // Absent player: they stay, give the card they hold, or deal the next round
  autoPlayFor,
  debug: debugCommands,
}
