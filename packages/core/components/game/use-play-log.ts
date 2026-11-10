"use client"

import { useEffect, useRef, useState } from "react"
import { createLogPlayer, type LogPlayerOptions } from "../../lib/log-player"
import { useMotion } from "../../lib/use-motion"
import { useGameLog } from "./context"

/**
 * Plays what happened on the table, line by line, for a board that animates from the log (`PublicGame.log`). `play` is given each new line in the order it was said and may return a promise: the next line waits for it.
 * `instant` is true when the line must not be animated, only applied (the visitor asks for less motion, the tab is hidden, or a lot of lines came at once after an absence).
 *
 * The first time a board opens a table it plays nothing: it draws the state (the view) and takes note of how far the log goes. `busy` is true while lines are playing: hold the buttons back until it is false.
 * The log tells what happened, the view tells what is there: draw the view, and use the lines for the motion between two views. The rules are those of `createLogPlayer` (`lib/log-player.ts`).
 *
 * ```ts
 * const { busy } = usePlayLog<Flip7Event>({
 *   play: async (line, { instant }) => {
 *     if (line.event.kind === "draw") await flyCard(line.event, instant)
 *   },
 * })
 * ```
 */
export function usePlayLog<E>({ play, catchUp }: { play: LogPlayerOptions<E>["play"]; catchUp?: number }): { busy: boolean } {
  const lines = useGameLog<E>()
  const reduced = useMotion() === "reduced"
  const [busy, setBusy] = useState(false)
  // What the player reads when a line is about to play: the latest handler and motion, not the ones of the render that made the player
  const latest = useRef({ play, lines, reduced })
  const player = useRef<ReturnType<typeof createLogPlayer<E>> | null>(null)

  useEffect(() => {
    latest.current = { play, lines, reduced }
  })

  useEffect(() => {
    const created = createLogPlayer<E>({
      play: (line, context) => latest.current.play(line, context),
      instant: () => latest.current.reduced || document.hidden,
      catchUp,
      onBusy: setBusy,
      onError: (error) => console.error("A line of the log could not be played", error),
    })
    player.current = created
    created.sync(latest.current.lines)
    return () => {
      created.stop()
      player.current = null
    }
  }, [catchUp])

  useEffect(() => {
    player.current?.sync(lines)
  }, [lines])

  return { busy }
}
