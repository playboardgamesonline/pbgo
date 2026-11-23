"use client"

import { useEffect, useRef, useState } from "react"
import { createMoveClock, type MoveClock, type Pace } from "../../lib/move-pace"

/**
 * The clock of a board that holds back what a move ends with until the move has played out: `busy` is true from the render that receives the move until its time has passed, and `playing` says that the last move is one this board watched come, not
 * one that was already there when it opened (a table that is opened or reloaded plays nothing). The pace is what the board worked out from the log (`paceOf`).
 *
 * `openedAt` is the version that was there when the board opened (0 when it opened with nothing played, or behind the start screen). `held` is true while the platform's start screen is up: the cards of the opening deal are not drawn behind it, so their clock starts when the screen goes.
 *
 * ```ts
 * const pace = useMemo(() => timelineOf(log, motion === "reduced"), [log, motion])
 * const { busy, playing } = useMoveClock(pace, held)
 * const { announce, element } = useAnnouncements(settings, { paused: busy })
 * ```
 *
 * `busy` comes from the version, in the very render that receives it: a board that holds back what the view says needs to know before the first draw, which an effect (`busy` of `usePlayLog`) cannot say until a render later.
 */
export function useMoveClock(pace: Pace, held = false): { busy: boolean; playing: boolean; openedAt: number } {
  const [opened] = useState(() => (held ? 0 : pace.v))
  const [played, setPlayed] = useState(opened)
  const clock = useRef<MoveClock | null>(null)

  useEffect(() => {
    const created = createMoveClock({ opened, onPlayed: setPlayed })
    clock.current = created
    return () => {
      created.stop()
      clock.current = null
    }
  }, [opened])

  useEffect(() => {
    // behind the start screen the cards of the opening deal are not drawn: the clock of the deal starts when the screen goes
    if (!held) clock.current?.note(pace.v, pace.settle)
  }, [pace.v, pace.settle, held])

  return { busy: played < pace.v, playing: pace.v > opened, openedAt: opened }
}
