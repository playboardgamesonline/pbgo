import type { GameDefinition } from "@pbgo/engine-kit"
import { step } from "./actions"
import { autoPlayFor, autoPlayStep } from "./autoplay"
import { debugCommands } from "./debug"
import { isOver, progress, waitingFor } from "./machine"
import { MAX_PLAYERS, MIN_PLAYERS, setupGame } from "./setup"
import { type Action, CLIENT_ACTIONS, type CourtisansEvent, type PlayerView, type State } from "./types"
import { playerView } from "./view"

/** The game for @pbgo/core (the `@pbgo/engine-kit` contract). */
export const GAME: GameDefinition<State, Action, PlayerView, undefined, CourtisansEvent> = {
  id: "courtisans",
  name: "Courtisans",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  options: {},
  // The lines of the score that the end screen shows for each player, in this order; their words are `score.<key>` in the game's Sanity
  scoreLines: ["domain", "missions"],
  clientActions: CLIENT_ACTIONS,
  setup: ({ players, seed }) => setupGame({ players, seed }),
  apply: (state, action) => step(state, action).state,
  // What each move did, for the platform to keep in the log of the table: the state holds none
  step,
  view: (state, playerId) => playerView(state, playerId),
  isOver,
  // The cards played out of the cards in play: the platform shows it as how far the game has come
  progress,
  // While the missions are read every player who has not read theirs; then the player of the turn; nobody once the game is over
  waitingFor,
  // Absent player: their missions are read for them, or their whole turn is played (up to 3 cards)
  autoPlayFor,
  autoPlayStep,
  // For development: say that everybody has read their missions, play a turn or the game out
  debug: debugCommands,
}
