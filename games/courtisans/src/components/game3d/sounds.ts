"use client"

import type { CourtisansEvent } from "@courtisans/engine"
import { useEffect, useRef } from "react"
import type { LogLine } from "@pbgo/core/lib/game-types"
import { playSound as playCoreSound } from "@pbgo/core/lib/sound"
import type { SoundName } from "../../lib/sounds"
import type { EndingState } from "./ending"

/** Core's `playSound`, restricted to the effects declared in `SOUNDS`: a misspelled name no longer compiles. */
export function playSound(name: SoundName, options?: Parameters<typeof playCoreSound>[1]) {
  playCoreSound(name, options)
}

export function useGameSounds(log: readonly LogLine<CourtisansEvent>[], ending: EndingState | null, selectionId: number | null, missionFocus: string | null) {
  // The lines that are there when the board opens are not played: only those that come after, by the version of the table
  const playedV = useRef(log.at(-1)?.v ?? 0)
  useEffect(() => {
    const newOnes = log.filter((line) => line.v > playedV.current).map((line) => line.event)
    playedV.current = Math.max(playedV.current, log.at(-1)?.v ?? 0)
    let t = 0
    for (const e of newOnes) {
      if (e.type === "cardPlayed") {
        playSound("slide", { delay: t })
        playSound("place", { delay: t + 0.95 })
        if (e.card.role === "assassin") playSound("assassin", { delay: t + 1.05 })
        t += 0.15
      } else if (e.type === "cardEliminated") {
        playSound("eliminate", { delay: t + 1.2 })
      } else if (e.type === "draw") {
        for (let i = 0; i < e.count; i++) playSound("slide", { delay: t + 0.35 + i * 0.28, volume: 0.8 })
      }
    }
  }, [log])

  useEffect(() => {
    if (selectionId) playSound("select")
  }, [selectionId])

  useEffect(() => {
    if (missionFocus) playSound("reveal")
  }, [missionFocus])

  const previous = useRef<EndingState | null>(null)
  useEffect(() => {
    const before = previous.current
    previous.current = ending
    if (!ending) return
    if (ending.tableSpies === "flip" && before?.tableSpies !== "flip") for (let i = 0; i < 4; i++) playSound("reveal", { delay: i * 0.09 })
    if (ending.families > (before?.families ?? 0)) playSound("place", { volume: 0.8 })
    if (ending.domains && !before?.domains) for (let i = 0; i < 4; i++) playSound("reveal", { delay: i * 0.09 })
    if (ending.pile > (before?.pile ?? 0)) playSound("click", { volume: 1.4 })
    if (ending.missions && !before?.missions) playSound("mission")
    if (ending.text && !before?.text) playSound("victory")
  }, [ending])
}
