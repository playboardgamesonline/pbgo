"use client"

import { useEffect, useRef } from "react"
import type { PublicGame } from "./game-types"

/** The most a board waits, in milliseconds, after its countdown ended before it asks the server to play the deadline: a different time for each board, so that a table of boards does not ask in the same instant. Whoever asks first plays it */
const SPREAD_MS = 300

/**
 * The countdown of the table's deadline on a board: where it ends on the page's own clock (`performance.now()`), counted from the moment the table was read (`receivedAt`) with the time the server said was left (`PublicGame.deadlineInMs`, a
 * duration, so a clock that is off does not matter). When it ends it calls `tick`, once for each time it was set, a few milliseconds after, and the server plays the deadline if it has passed (`POST …/tick`); a board that never gets that far is
 * moved on by the read that it polls. Null for a game with no clock and a table that is not in play: nothing is counted and nothing is sent.
 */
export function useDeadline(game: Pick<PublicGame, "status" | "deadlineInMs">, receivedAt: number, tick: () => Promise<unknown>): number | null {
  const endsAt = game.status === "playing" && game.deadlineInMs !== null ? receivedAt + game.deadlineInMs : null
  // What the timer calls is the newest `tick`, not the one of the render that set it
  const latest = useRef(tick)
  useEffect(() => {
    latest.current = tick
  })
  useEffect(() => {
    if (endsAt === null) return
    const timer = setTimeout(() => void latest.current().catch(() => undefined), Math.max(0, endsAt - performance.now()) + Math.random() * SPREAD_MS)
    return () => clearTimeout(timer)
  }, [endsAt])
  return endsAt
}
