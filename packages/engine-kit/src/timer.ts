/**
 * Timers. A timer is the clock of a step in the state: the time it ends at and how long it was set for, two numbers, so that a state that holds one is plain data and a view can say how far the clock has run. An engine starts it inside
 * `apply` from the `at` of the action that began the step, says in `nextDeadline` that the step ends at `endsAt`, and plays the system action that closes it then. It never asks a clock: what it knows of time is what the server told it (`PlayerAction.at`).
 *
 * The board draws the time that is left with a `Timer`, from what the table tells its players (`deadlineInMs`), not from the state.
 */

/** A clock of a step: when it ends, in milliseconds since the epoch on the server's clock, and how long it was set for, in seconds */
export type Timer = { endsAt: number; seconds: number }

const checkTime = (at: number) => {
  if (!Number.isFinite(at)) throw new RangeError(`A time is a finite number of milliseconds, got ${String(at)}`)
}

/** A timer set for `seconds` that starts at `at`. A time that is not finite and a length that is not above zero throw a `RangeError`: they are bugs of the game, not moves of a player */
export function startTimer(at: number, seconds: number): Timer {
  checkTime(at)
  if (!Number.isFinite(seconds) || !(seconds > 0)) throw new RangeError(`A timer is set for a finite number of seconds above zero, got ${String(seconds)}`)
  return { endsAt: at + seconds * 1000, seconds }
}

/** The same timer set again from `at`, for as long as it was: a window that opens again each time somebody answers (the Nope of Exploding Kittens) */
export function restartTimer(timer: Timer, at: number): Timer {
  return startTimer(at, timer.seconds)
}

/** The timer with `seconds` more: the time it ends at moves by as much, and so does the length it was set for, so what is left is never more than the whole. A length that is not finite or is below zero throws a `RangeError` */
export function extendTimer(timer: Timer, seconds: number): Timer {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError(`A timer gets a finite number of seconds, none or more, got ${String(seconds)}`)
  return { endsAt: timer.endsAt + seconds * 1000, seconds: timer.seconds + seconds }
}

/** How long is left at `now`, in milliseconds, never below zero */
export function timeLeft(timer: Timer, now: number): number {
  checkTime(now)
  return Math.max(0, timer.endsAt - now)
}

/** Whether the timer has run out at `now`: the instant it ends at is already out */
export function timerDone(timer: Timer, now: number): boolean {
  checkTime(now)
  return now >= timer.endsAt
}

/** How much of the timer is left at `now`, from 1 (all of it) to 0 (none): what fills a ring or a bar */
export function timerFraction(timer: Timer, now: number): number {
  return Math.min(1, timeLeft(timer, now) / (timer.seconds * 1000))
}
