import type { GameDefinition } from "@pbgo/engine-kit"
import { step } from "./actions"
import { autoPlayFor, autoPlayStep } from "./autoplay"
import { debugCommands } from "./debug"
import { isOver, progress, waitingFor } from "./machine"
import { OPTIONS } from "./options"
import { MAX_PLAYERS, MIN_PLAYERS, setupGame, setupStep } from "./setup"
import { type Action, CLIENT_ACTIONS, type Flip7Event, type PlayerView, type State } from "./types"
import { playerView } from "./view"

/** The game for @pbgo/core (the `@pbgo/engine-kit` contract). */
export const GAME: GameDefinition<State, Action, PlayerView, undefined, Flip7Event> = {
  id: "flip-7",
  name: "Flip 7",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  options: OPTIONS,
  // The lines of the score that the end screen shows for each player, in this order; their words are `score.<key>` in the game's Sanity
  scoreLines: ["rounds", "bestRound", "flip7", "busts"],
  clientActions: CLIENT_ACTIONS,
  setup: ({ players, options, seed }) => setupGame({ players, options, seed }),
  // The first round is dealt while the game is set up: the log opens with it
  setupStep: ({ players, options, seed }) => setupStep({ players, options, seed }),
  apply: (state, action) => step(state, action).state,
  // What each move did, for the platform to keep in the log of the table: the state holds none
  step,
  view: (state, playerId) => playerView(state, playerId),
  isOver,
  // The best total over the target score: the platform shows it as how far the game has come
  progress,
  // The player of the turn, the holder of an action card, or the next dealer between two rounds: always one player
  waitingFor,
  // Absent player: they stay, give the card they hold, or deal the next round
  autoPlayFor,
  autoPlayStep,
  debug: debugCommands,
}
