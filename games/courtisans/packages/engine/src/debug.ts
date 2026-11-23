import { autoPlayFor } from "./autoplay"
import { isOver, waitingFor } from "./machine"
import type { State } from "./types"

/**
 * The debug panel (`GAME.debug`), for development only. `missions` says that every player has read their missions, which starts the banquet; `turn` plays the turn that is going on (the missions are read first when
 * they have not been), and `over` plays the game to the end, as an absent player would be.
 */

/** Guards against a loop that does not end; a game is a hundred cards at the most. */
const GAME_STEPS = 400

/** The game goes one step further: the player it waits for is played for. */
function playOne(state: State): State {
  const [first] = waitingFor(state)
  return first === undefined ? state : autoPlayFor(state, first)
}

/** Every player has read their missions: the banquet starts. */
function readAll(state: State): State {
  let s = state
  for (let i = 0; i < state.seats.length && !s.read.every(Boolean); i++) s = playOne(s)
  return s
}

/** The turn that is going on is played out (the missions are read first when they have not been). */
function finishTurn(state: State): State {
  const read = readAll(state)
  return isOver(read) ? read : playOne(read)
}

function finishGame(state: State): State {
  let s = readAll(state)
  for (let i = 0; i < GAME_STEPS && !isOver(s); i++) s = playOne(s)
  return s
}

export const debugCommands: Record<string, (state: State) => State> = {
  missions: readAll,
  turn: finishTurn,
  over: finishGame,
}
