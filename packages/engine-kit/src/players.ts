import type { PlayerInfo } from "./contract"
import { EngineError } from "./errors"

/**
 * Refuses a table the game cannot play, as every `setup` must, with `INVALID_PLAYERS`: a `players` that is not a list or has seats that are not players, a number of players outside the bounds of the game, an empty id, the same id twice.
 * (The nicknames are the table's: the state keeps the ids only.)
 */
export function assertPlayers(players: readonly PlayerInfo[], bounds: { min: number; max: number }): void {
  // A table that is not a list, or whose seats are not players, is refused as any other is: it never reaches the engine as a TypeError
  if (!Array.isArray(players)) throw new EngineError("INVALID_PLAYERS")
  const ids = players.map((player: unknown) => (player as { id?: unknown } | null)?.id)
  const unusable = ids.some((id) => typeof id !== "string" || id === "") || new Set(ids).size !== ids.length
  if (players.length < bounds.min || players.length > bounds.max || unusable) throw new EngineError("INVALID_PLAYERS")
}

/** The seat of a player: their place in the array of the ids of the table, `-1` when they are not at it. The array is the only source of order. */
export function seatOf(seats: readonly string[], playerId: string): number {
  return seats.indexOf(playerId)
}

/** The id of the player in `seat`. A seat that does not exist is a bug of the engine, never a player's mistake, so it is a `RangeError`. */
export function playerAt(seats: readonly string[], seat: number): string {
  const id = seats[seat]
  if (id === undefined) throw new RangeError(`There is no seat ${seat}`)
  return id
}

/**
 * The seat that plays after `from`, going round the table clockwise, that `skip` does not rule out (a player who is out of the round, one who has stayed): `from` itself comes last, so a table where it is the only seat left gives `from`. `null` when every seat is ruled out.
 * Seat `n + 1` is on the left of seat `n`, and the turn passes to the left.
 */
export function nextSeat(count: number, from: number, skip: (seat: number) => boolean = () => false): number | null {
  for (let step = 1; step <= count; step++) {
    const seat = (((from + step) % count) + count) % count
    if (!skip(seat)) return seat
  }
  return null
}
