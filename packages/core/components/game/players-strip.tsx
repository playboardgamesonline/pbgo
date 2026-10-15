"use client"

import { pendingSeats } from "../../lib/pending-seats"
import { useText } from "../skin-provider"
import { useGame } from "./context"
import { PlayersStripView, type StripData, type StripLabels } from "./players-strip-view"

/**
 * The seats of a simultaneous step (secret bids, reading the missions…), under the main line of the ticker. Nothing when the game
 * waits for fewer than two players: a classic turn has no strip, the main line says whose turn it is. `waitingFor` is
 * `game.waitingFor`, public information the same for every viewer.
 */
export function PlayersStrip({ waitingFor, className }: { waitingFor: readonly string[]; className?: string }) {
  const t = useText()
  const { game, color } = useGame()
  const pending = pendingSeats({ players: game.players, waitingFor, present: game.present, meId: game.meId })
  if (!pending) return null
  const strip: StripData = { ...pending, seats: pending.seats.map((seat) => ({ ...seat, color: color(seat.id) })) }
  const labels: StripLabels = {
    players: t("players"),
    ready: t("playersReady", { ready: pending.ready, total: pending.total }),
    done: t("seatDone"),
    waiting: t("seatWaiting"),
    away: t("seatAway"),
    you: t("you"),
  }
  return <PlayersStripView strip={strip} labels={labels} className={className} />
}
