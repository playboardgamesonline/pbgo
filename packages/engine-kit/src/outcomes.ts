import type { Results } from "./contract"

// How a finished game ended for each player, the way the history records it (`game_participants.outcome`, PLT-13). The engine says it through its results and this file reads it, so that the platform, the history
// and the tests of an engine agree on one definition.

/**
 * What the engine can say of a player: `abandoned`, the sixth outcome of the history, is not here because the engine never knows that a player gave up. The platform writes it.
 */
export const PLAYER_OUTCOMES = ["win", "loss", "draw", "coop_win", "coop_loss"] as const

export type PlayerOutcome = (typeof PLAYER_OUTCOMES)[number]

function outcomeOf(results: Results, playerId: string): PlayerOutcome {
  if (results.coop !== undefined) return results.coop === "won" ? "coop_win" : "coop_loss"
  if (!results.winners.includes(playerId)) return "loss"
  // Everybody at the top of a table of two or more is a draw; some of them at the top beat the rest and win. A player alone at a table has no one to draw with
  return results.players.length > 1 && results.winners.length === results.players.length ? "draw" : "win"
}

/**
 * How the game ended for each player, in the order of `results.players`:
 * - `coop_win` or `coop_loss` for every player when the table plays together (`coop`);
 * - `win` for a winner, unless every player of the table is a winner, which is a `draw`: a tie for the first place among some of the players is a win for them, since they beat the rest;
 * - `loss` for the others.
 */
export function outcomesOf(results: Results): { playerId: string; outcome: PlayerOutcome }[] {
  return results.players.map(({ playerId }) => ({ playerId, outcome: outcomeOf(results, playerId) }))
}
