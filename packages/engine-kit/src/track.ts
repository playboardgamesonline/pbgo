/**
 * Tracks. A track is a row of spaces, numbered from `min` to `max`, that a marker moves along: a score track, the turn order of a round, the squares of a board that runs round and round, the steps of a climb. The state keeps where each marker
 * is, as a whole number, and nothing else (the board knows the spaces by their number); the engine moves it inside `apply` with `moveAlong` and says the move as an event of its log. The board walks the marker along the spaces with a
 * `TrackMarker`, one after the other, the way a pawn goes.
 *
 * `moveAlong` also says which spaces the marker went through: a game that pays for crossing the start, or that triggers what lies on a space it passes and not only on the one it stops on, reads them from the answer.
 */

/** The shape of a track */
export type TrackRules = {
  /** The first space (default 0) */
  min?: number
  /** The last space */
  max: number
  /** The track closes on itself: the space after `max` is `min`, and the one before `min` is `max` (a board that runs round, a rondel, a score track that goes past its last number and starts again) */
  loop?: boolean
}

/** What a move along a track did */
export type Walk = {
  /** The space the marker left */
  from: number
  /** The space it is on now */
  to: number
  /** The spaces it really went, with their sign: the end of a track that does not loop can cut a move short */
  moved: number
  /** The spaces it went through, in order, the last being `to`: one for each space of the move, and none when the marker did not move */
  passed: number[]
  /** How many times it crossed from `max` to `min` (counted +1 each time) or the other way (-1) on a track that loops: 1 for a marker that crosses the start, 0 for one that never does. Always 0 on a track that does not loop */
  laps: number
  /** The end that cut the move short, when one did: reaching an end exactly is not being cut short */
  stopped: "min" | "max" | null
}

/** The most spaces one move may go: a move of more is a bug of the game, and its `passed` would fill the memory */
export const MAX_WALK = 100_000

/** A zero is a zero: a state that holds -0 is not the state that holds 0, once it has been through JSON */
const clean = (value: number) => (value === 0 ? 0 : value)

/** The remainder of a division that is never negative: -1 modulo 5 is 4, which is where one step back from the first of five spaces lands */
const modulo = (value: number, by: number) => ((value % by) + by) % by

/**
 * A marker on space `from` moved `steps` spaces along the track: forward when `steps` is above zero, back when it is below. On a track that loops it goes round; on one that does not it stops at the end, and `stopped` says which. Throws a
 * `RangeError` for a track that has no space or whose ends are not whole numbers, a marker that is not on a space of it and a number of steps that is not a whole number: they are bugs of the game, not moves of a player (what a player sends is
 * checked with `cleanNumber` first).
 */
export function moveAlong(track: TrackRules, from: number, steps: number): Walk {
  const { min = 0, max, loop = false } = track
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) throw new RangeError(`A track runs between whole numbers, from the least to the greatest, got ${String(min)} to ${String(max)}`)
  if (!Number.isInteger(from) || from < min || from > max) throw new RangeError(`There is no space ${String(from)} on a track from ${min} to ${max}`)
  if (!Number.isInteger(steps)) throw new RangeError(`A marker goes a whole number of spaces, got ${String(steps)}`)
  if (Math.abs(steps) > MAX_WALK) throw new RangeError(`A marker cannot go ${steps} spaces at once`)

  if (loop) {
    const length = max - min + 1
    const offset = from - min + steps
    const direction = Math.sign(steps)
    const passed = Array.from({ length: Math.abs(steps) }, (_, i) => min + modulo(from - min + direction * (i + 1), length))
    return { from, to: min + modulo(offset, length), moved: clean(steps), passed, laps: clean(Math.floor(offset / length)), stopped: null }
  }

  const asked = from + steps
  const to = Math.min(max, Math.max(min, asked))
  const direction = Math.sign(to - from)
  const passed = Array.from({ length: Math.abs(to - from) }, (_, i) => from + direction * (i + 1))
  return { from, to, moved: clean(to - from), passed, laps: 0, stopped: asked > max ? "max" : asked < min ? "min" : null }
}
