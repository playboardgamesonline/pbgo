import type { LogLine } from "./game-types"

/**
 * Plays the lines of a table's log as they come, for a board that animates what happened (`PublicGame.log`, `useGameLog`). Pure: the hook `usePlayLog` is what puts it in a component.
 *
 * - The first time it is given the log it plays nothing: it takes note of how far the log goes (`v` of the last line) and the board draws the state, as it does when a player opens a table or reloads the page.
 * - After that every line with a `v` greater than the last one it took note of is new. They are played one after the other, in the order they were said, and each waits for the one before it: `play` may return a promise.
 * - A line is played `instant` (the handler applies its effect without moving anything) when motion is off (`instant()`), and for all the lines that came at once when there are more than `catchUp`: a player who was away does not watch a minute of cards fly.
 * - The same lines given again (the table is read on a timer and on every ping) change nothing; lines older than the last one it took note of are never played; a log that was emptied (a new game) does not stop the next moves from being played, since the versions only grow.
 * - A handler that throws or rejects is reported (`onError`) and the next line plays: one broken animation does not freeze the board.
 */
export type LogPlayerOptions<E> = {
  /** Plays one line. A promise holds the next line back until it settles */
  play: (line: LogLine<E>, context: { instant: boolean }) => void | Promise<void>
  /** Whether lines must not be animated right now (the visitor asks for less motion, the tab is hidden): read when a line is about to play */
  instant?: () => boolean
  /** More new lines than this at once are all played instantly (default 12) */
  catchUp?: number
  /** Told when the player starts and stops having lines to play: the board can hold its buttons back while lines play */
  onBusy?: (busy: boolean) => void
  onError?: (error: unknown, line: LogLine<E>) => void
}

export type LogPlayer<E> = {
  /** Gives the player the log as the table sent it */
  sync(lines: readonly LogLine<E>[]): void
  /** Drops what is waiting; a line that is playing finishes. The player takes no more lines */
  stop(): void
  readonly busy: boolean
  /** The greatest `v` it took note of (played, playing or waiting); null before the first `sync` */
  readonly last: number | null
}

export const DEFAULT_CATCH_UP = 12

export function createLogPlayer<E>({ play, instant = () => false, catchUp = DEFAULT_CATCH_UP, onBusy, onError }: LogPlayerOptions<E>): LogPlayer<E> {
  let last: number | null = null
  let waiting: { line: LogLine<E>; instant: boolean }[] = []
  let running = false
  let stopped = false
  let busy = false

  const setBusy = (value: boolean) => {
    if (busy === value) return
    busy = value
    onBusy?.(value)
  }

  async function run() {
    if (running) return
    running = true
    setBusy(true)
    try {
      while (waiting.length > 0 && !stopped) {
        const next = waiting.shift()!
        try {
          await play(next.line, { instant: next.instant || instant() })
        } catch (error) {
          onError?.(error, next.line)
        }
      }
    } finally {
      running = false
      setBusy(false)
    }
  }

  return {
    sync(lines) {
      if (stopped) return
      const top = lines.reduce((greatest, line) => Math.max(greatest, line.v), -Infinity)
      if (last === null) {
        last = lines.length > 0 ? top : 0
        return
      }
      const fresh = lines.filter((line) => line.v > last!)
      if (fresh.length === 0) return
      last = top
      const quick = fresh.length > catchUp
      waiting.push(...fresh.map((line) => ({ line, instant: quick })))
      void run()
    },
    stop() {
      stopped = true
      waiting = []
    },
    get busy() {
      return busy
    },
    get last() {
      return last
    },
  }
}
