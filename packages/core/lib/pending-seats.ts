import type { PlayerInfo } from "@pbgo/engine-kit"

/** Seats up to which the strip lists every player; beyond, it shows "ready / total" and the list on demand */
export const STRIP_MAX_SEATS = 8

export type PendingSeat = {
  id: string
  nickname: string
  /** The game still waits for this player */
  waiting: boolean
  /** Not seen at the table in the last 75 s */
  away: boolean
  /** The viewer */
  me: boolean
}

export type PendingSeats = {
  /** In seat order */
  seats: PendingSeat[]
  /** Seats the game no longer waits for */
  ready: number
  total: number
  /** Too many seats for one chip each */
  collapsed: boolean
}

/**
 * Seat by seat, who a simultaneous step still waits for (secret bids, reading the missions…). Only public information:
 * `waitingFor`, `present` and the table's players, the same for every viewer.
 *
 * `null` when the game waits for fewer than two players: a classic turn, or nothing, has no strip (the main line of the
 * ticker says whose turn it is).
 */
export function pendingSeats({
  players,
  waitingFor,
  present,
  meId,
}: {
  players: readonly PlayerInfo[]
  waitingFor: readonly string[]
  present: readonly string[]
  meId: string | null
}): PendingSeats | null {
  if (waitingFor.length < 2) return null
  const waiting = new Set(waitingFor)
  const here = new Set(present)
  const seats = players.map((p) => ({ id: p.id, nickname: p.nickname, waiting: waiting.has(p.id), away: !here.has(p.id), me: p.id === meId }))
  return { seats, ready: seats.filter((s) => !s.waiting).length, total: seats.length, collapsed: seats.length > STRIP_MAX_SEATS }
}
