"use client"

import type { CourtisansEvent } from "@courtisans/engine"
import { useEffect, useRef } from "react"
import type { LogLine } from "@pbgo/core/lib/game-types"
import type { SoundCue } from "@pbgo/core/lib/sound-cues"
import { playSound as playCoreSound } from "@pbgo/core/lib/sound"
import type { SoundName } from "../../lib/sounds"
import type { EndingState } from "./ending"

/** Core's `playSound`, restricted to the effects declared in `SOUNDS`: a misspelled name no longer compiles. */
export function playSound(name: SoundName, options?: Parameters<typeof playCoreSound>[1]) {
  playCoreSound(name, options)
}

/** What a line of the log sounds like, when no card shows it: an assassin that is played, a card that is eliminated. The cards make the sounds of their own flights. */
export function cuesOf(line: LogLine<CourtisansEvent>): SoundCue[] {
  const event = line.event
  if (event.type === "cardPlayed" && event.card.role === "assassin") return [{ name: "assassin", delay: 1.05 }]
  if (event.type === "cardEliminated") return [{ name: "eliminate", delay: 1.2 }]
  return []
}

/** The sounds that are the board's own, not a line's: a mission looked at, and the steps of the ending. */
export function useBoardSounds(ending: EndingState | null, missionFocus: string | null) {
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
