"use client"

import { useEffect, useRef } from "react"
import type { LogLine } from "../../lib/game-types"
import { createLogPlayer, type LogPlayer } from "../../lib/log-player"
import { playSound } from "../../lib/sound"
import { LINE_GAP, type SoundCue, scheduleCues } from "../../lib/sound-cues"
import { useGameLog } from "./context"

/**
 * Plays the sounds of what happened on the table, line by line, as the lines of the log come (`PublicGame.log`): `cues` says which effects a line makes, and when. The sounds of a card that moves are the card's own (`slide` as it flies off,
 * `place` as it lands: `@pbgo/table`), so a line only says what no card shows: an elimination, a reveal, the end of a round.
 *
 * It plays by the rules of `createLogPlayer`: the first time it is given the log it plays nothing (a table that is opened or reloaded is silent), a backlog that comes at once after an absence plays nothing, and a hidden tab plays nothing. Lines that come together are
 * heard one after the other, `gap` seconds apart, and a line's own `delay`s are counted from there. A sound is skipped, as everywhere, when it is not declared in the game's `SOUNDS`, and silent when it has no file in Sanity.
 *
 * ```ts
 * useLogSounds<Event>({
 *   cues: (line) => (line.event.type === "eliminated" ? [{ name: "eliminate", delay: 1.2 }] : []),
 * })
 * ```
 */
export function useLogSounds<E>({ cues, gap = LINE_GAP }: { cues: (line: LogLine<E>) => readonly SoundCue[]; gap?: number }): void {
  const lines = useGameLog<E>()
  // What the player reads when a line is about to play: the latest cues, not the ones of the render that made it
  const latest = useRef({ cues, gap, lines })
  const player = useRef<LogPlayer<E> | null>(null)

  useEffect(() => {
    latest.current = { cues, gap, lines }
  })

  useEffect(() => {
    // Which line of the batch this is: lines that came together are played one after the other with no wait, and the count starts again when they are done
    let index = 0
    const created = createLogPlayer<E>({
      play: (line, { instant }) => {
        if (instant) return
        for (const cue of scheduleCues(latest.current.cues(line), index, latest.current.gap)) playSound(cue.name, { delay: cue.delay, volume: cue.volume, bus: cue.bus })
        index++
      },
      instant: () => document.hidden,
      onBusy: (busy) => {
        if (!busy) index = 0
      },
      onError: (error) => console.error("A sound of the log could not be played", error),
    })
    player.current = created
    created.sync(latest.current.lines)
    return () => {
      created.stop()
      player.current = null
    }
  }, [])

  useEffect(() => {
    player.current?.sync(lines)
  }, [lines])
}
