import type { LogLine } from "./game-types"

/**
 * The pace of a move: when each thing a move did happens, and when the move is over. The log says what happened and in what order (`useGameLog`: the lines of one move share their version `v`), the board decides how long each thing takes: a
 * card turned over takes about as long as it needs to land, a stay is quick, a reveal lasts as long as it takes to read. The view is drawn at once and is what is there; the pace is what the board waits with, so that the cards come in one after the
 * other and the words that say how the move ended wait for it to end. Pure: `useMoveClock` puts the clock in a component, and `usePlayLog` is the other way, which plays the lines one by one.
 *
 * `paceOf` walks the lines of the last move and `createMoveClock` times the moves a board is given, one after the other.
 */

/** What the clock of a board needs to know of a move: its version, and the seconds until it has played out */
export type Pace = {
  /** The greatest version of the log, the move that was played last (0 for an empty log) */
  v: number
  /** Seconds until that move has played out: the last thing has had its time and the last card has landed */
  settle: number
}

export type PaceRules<E> = {
  /** How long each thing that happened keeps the table busy before the next one begins, in seconds */
  beat: (event: E) => number
  /** How long a card needs to land once it has set out, in seconds: a move is not over before the last card has landed, whatever its beats add up to */
  landing: number
  /** The visitor asks for less motion: nothing waits and nothing is visited, the move is over as it comes */
  instant?: boolean
}

/** Where a move is when one of its events is told, and what that event can do to its pace */
export type MoveCursor = {
  /** The second of the move this event begins at: the beats of the events before it, and what was held */
  readonly at: number
  /** Something sets out `delay` seconds into the move, now by default, and needs the landing time to arrive. Gives the delay back, for the entrance of the card */
  land(delay?: number): number
  /** Holds what comes next back by `seconds` more than the beat of this event: a deal that goes round the table */
  hold(seconds: number): void
}

/**
 * The pace of the last move of a log: `visit` is given each event of it, in the order the engine said them, with a cursor that says when it happens, and the beat of each event is added after it. The board collects what it needs while it
 * walks (the entrance of each card, what is shown to be read), and `landing` settles when the last card has arrived. The lines of the older moves are not visited: a table that has played ten moves paces the tenth.
 *
 * ```ts
 * const entrances = new Map<number, number>()
 * const pace = paceOf(log, { beat: beatOf, landing: 0.85, instant: reduced }, (event, cursor) => {
 *   if (event.kind === "draw") entrances.set(event.card.id, cursor.land())
 * })
 * ```
 */
export function paceOf<E>(lines: readonly LogLine<E>[], { beat, landing, instant = false }: PaceRules<E>, visit: (event: E, cursor: MoveCursor) => void): Pace {
  const v = lines.reduce((greatest, line) => Math.max(greatest, line.v), 0)
  if (instant || v === 0) return { v, settle: 0 }
  let at = 0
  let landed = 0
  const cursor: MoveCursor = {
    get at() {
      return at
    },
    land(delay = at) {
      landed = Math.max(landed, delay + landing)
      return delay
    },
    hold(seconds) {
      at += seconds
    },
  }
  for (const line of lines) {
    if (line.v !== v) continue
    visit(line.event, cursor)
    at += beat(line.event)
  }
  return { v, settle: Math.max(at, landed) }
}

export type MoveClockOptions = {
  /** The version that was there when the board opened: that move is already played, and a table that is opened or reloaded plays nothing of it (0 to play the opening deal, which is drawn when the start screen goes) */
  opened: number
  /** Told when the move of this version has played out */
  onPlayed: (v: number) => void
  /** The clock and the timers, so that a test needs no wait */
  now?: () => number
  setTimer?: (run: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}

export type MoveClock = {
  /** Takes note of a move, its version and the seconds it needs. A move that was taken note of is not timed again, and one that comes while another is playing out is over when both are */
  note(v: number, settle: number): void
  /** Drops the timer: the board is gone */
  stop(): void
}

/**
 * The clock of a board that holds back what a move ends with (the announcements, the words under a seat, the end screen) until the move has played out. It says when a move is over; that it is playing is known by the board in the very render that
 * receives the version, from the version alone (`useMoveClock`), which an effect cannot say until a render later.
 */
export function createMoveClock({ opened, onPlayed, now = Date.now, setTimer = setTimeout, clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>) }: MoveClockOptions): MoveClock {
  let noted = opened
  let freeAt = 0
  let timer: unknown = null
  const drop = () => {
    if (timer !== null) clearTimer(timer)
    timer = null
  }
  return {
    note(v, settle) {
      if (v <= noted) return
      noted = v
      // a move that comes while another plays out is over when both are
      freeAt = Math.max(freeAt, now() + settle * 1000)
      drop()
      timer = setTimer(() => {
        timer = null
        onPlayed(v)
      }, Math.max(0, freeAt - now()))
    },
    stop: drop,
  }
}
