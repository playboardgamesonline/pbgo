import type { PlayerInfo } from "./contract"
import { EngineError } from "./errors"

/**
 * Refuses a table the game cannot play, as every `setup` must, with `INVALID_PLAYERS`: a number of players outside the bounds of the game, an empty id, the same id twice.
 * (The nicknames are the table's: the state keeps the ids only.)
 */
export function assertPlayers(players: readonly PlayerInfo[], bounds: { min: number; max: number }): void {
  const ids = players.map((player) => player.id)
  const unusable = ids.some((id) => typeof id !== "string" || id === "") || new Set(ids).size !== ids.length
  if (players.length < bounds.min || players.length > bounds.max || unusable) throw new EngineError("INVALID_PLAYERS")
}
