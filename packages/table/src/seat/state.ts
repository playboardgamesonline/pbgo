import type { GameStatus } from "@pbgo/core/lib/game-types"

/** What the platform's table says about its seats: `PublicGame` carries the first three, and the winners are the `results` of the game's view once it is over. */
export type SeatTable = {
  status: GameStatus
  waitingFor: readonly string[]
  present: readonly string[]
  winners: readonly string[]
}

export type SeatState = {
  /** The player of the turn: the only one the game waits for */
  active: boolean
  /** One of several players the game waits for at once (a simultaneous step) */
  waiting: boolean
  /** Not seen at the table in the last seconds, while the game goes on */
  away: boolean
  /** A winner, once the game is over */
  winner: boolean
}

/** The state of the seat of `id` as the table says it. A player the game waits for and who is away is both. */
export function seatStateOf(table: SeatTable, id: string): SeatState {
  const expected = table.waitingFor.includes(id)
  return {
    active: expected && table.waitingFor.length === 1,
    waiting: expected && table.waitingFor.length > 1,
    away: table.status === "playing" && !table.present.includes(id),
    winner: table.status === "over" && table.winners.includes(id),
  }
}
