"use client"

import type { CourtisansResults, PlayerView } from "@courtisans/engine"
import { useControls } from "@pbgo/core/components/game/debug-controls"
import { useMemo } from "react"

export const NONE = "—"

export function cheat(results: CourtisansResults, winner: string): CourtisansResults {
  const target = results.players.find((j) => j.playerId === winner)
  if (!target) return results
  const best = Math.max(...results.players.filter((j) => j.playerId !== winner).map((j) => j.total), 0)
  const bonus = Math.max(0, best - target.total + 3)
  const players = results.players
    .map((j) =>
      j.playerId === winner ? { ...j, missions: [...j.missions, { missionId: "cheat", done: true, points: bonus }], total: j.total + bonus } : j,
    )
    .sort((a, b) => b.total - a.total)
  for (const j of players) j.rank = 1 + players.filter((o) => o.total > j.total).length
  const top = players[0]!.total
  return { ...results, players, winners: players.filter((j) => j.total === top).map((j) => j.playerId) }
}

export function useCheat(view: PlayerView, nickname: (id: string) => string): PlayerView {
  const options = useMemo(() => Object.fromEntries([[NONE, NONE], ...view.players.map((j) => [nickname(j.id), j.id])]), [view.players, nickname])
  const { winner } = useControls("Cheat", { winner: { options, value: NONE, label: "make winner" } }, [options])
  return useMemo(() => {
    if (!view.results || winner === NONE) return view
    return { ...view, results: cheat(view.results, winner as string) }
  }, [view, winner])
}
