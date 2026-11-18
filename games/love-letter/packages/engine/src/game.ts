import type { GameDefinition } from "@pbgo/engine-kit"
import { step } from "./actions"
import { autoPlayFor, autoPlayStep } from "./autoplay"
import { debugCommands } from "./debug"
import { isOver, progress, waitingFor } from "./machine"
import { OPTIONS } from "./options"
import { MAX_PLAYERS, MIN_PLAYERS, setupGame, setupStep } from "./setup"
import { type Action, CLIENT_ACTIONS, type LoveLetterEvent, type PlayerView, type State } from "./types"
import { playerView } from "./view"

/** The game for @pbgo/core (the `@pbgo/engine-kit` contract). */
export const GAME: GameDefinition<State, Action, PlayerView, undefined, LoveLetterEvent> = {
  id: "love-letter",
  name: "Love Letter",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  options: OPTIONS,
  // The lines of the score that the end screen shows for each player, in this order; their words are `score.<key>` in the game's Sanity
  scoreLines: ["rounds", "won", "spy"],
  clientActions: CLIENT_ACTIONS,
  setup: ({ players, options, seed }) => setupGame({ players, options, seed }),
  // The first round is dealt while the game is set up: the log opens with it
  setupStep: ({ players, options, seed }) => setupStep({ players, options, seed }),
  apply: (state, action) => step(state, action).state,
  // What each move did, for the platform to keep in the log of the table: the state holds none
  step,
  view: (state, playerId) => playerView(state, playerId),
  isOver,
  // The best player's favor tokens over the tokens that win: the platform shows it as how far the game has come
  progress,
  // The player of the turn; between two rounds the player who takes the first turn and deals; nobody once the game is over
  waitingFor,
  // Absent player: they play their whole turn, or deal the next round
  autoPlayFor,
  autoPlayStep,
  // For development: play a turn, a round or the game out, and rig the table to reach a situation of the board at once
  debug: debugCommands,
}
