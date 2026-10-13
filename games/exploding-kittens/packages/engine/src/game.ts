import type { GameDefinition } from "@pbgo/engine-kit"
import { step } from "./actions"
import { autoPlayFor } from "./autoplay"
import { debugCommands } from "./debug"
import { waitingFor } from "./machine"
import { ORIGINAL_RULES, type Rules } from "./rules"
import { MAX_PLAYERS, MIN_PLAYERS, setupGame } from "./setup"
import { type Action, CLIENT_ACTIONS, type PlayerView, type State } from "./types"
import { playerView } from "./view"

/**
 * The game for @pbgo/core (the `@pbgo/engine-kit` contract), made from the rules of a deck. The Original Edition is `GAME`; a
 * deck with other cards, effects or options passes its own rules.
 */
export function createGame(rules: Rules): GameDefinition<State, Action, PlayerView> {
  return {
    id: "exploding-kittens",
    name: "Exploding Kittens",
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    options: rules.options,
    clientActions: CLIENT_ACTIONS,
    setup: ({ players, options, seed }) => setupGame(rules, { players, options, seed }),
    apply: (state, action) => step(rules, state, action).state,
    view: (state, playerId) => playerView(rules, state, playerId),
    isOver: (state) => state.phase.kind === "over",
    // The player whose turn it is; in a Nope window, everyone who may still answer (the ones who passed too: who passed is hidden)
    waitingFor,
    // Absent player: they draw, put the Kitten back, give a card… or the window they were holding closes
    autoPlayFor: (state, playerId) => autoPlayFor(rules, state, playerId),
    debug: debugCommands(rules),
  }
}

export const GAME = createGame(ORIGINAL_RULES)
