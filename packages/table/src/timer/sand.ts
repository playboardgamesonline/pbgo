/**
 * The sand of an hourglass, as numbers: where it stands for what is left of the time. The hourglass is drawn at the unit height (its glass from 0.075 to 0.925, the neck at 0.5), the sand in the top bulb a cone whose point is at the neck and the
 * sand in the bottom bulb a pile with a point on top. Both volumes follow the time, so each height is the cube root of its share (a cone and a pile of one slope grow as the cube of their height): the top empties slowly at first and quicker at the end,
 * as a real one does.
 */

/** The height of the neck of the glass, and of the floor of its bottom bulb, in the unit height of the hourglass */
export const NECK = 0.5
export const FLOOR = 0.075

/** How high the sand stands above the neck when the top bulb is full, and how wide the cone of it is there */
export const TOP_REACH = 0.28
export const TOP_RADIUS = 0.33
/** How high the pile in the bottom bulb is when all the sand is in it, how much wider than high its foot is, and the widest it gets: the glass */
export const PILE_HEIGHT = 0.24
export const PILE_SLOPE = 1.3
export const PILE_WIDEST = 0.31

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/**
 * What is left of the time, from 1 (all of it) to 0 (none). With no clock running (`endsAt` null) it is `rest`, from 0 to 1: a timer that waits shows its time as it stands. `endsAt` and `now` are on the same clock, in milliseconds; a length
 * that is not above zero is no time at all.
 */
export function shareLeft(endsAt: number | null, now: number, seconds: number, rest = 1): number {
  if (!(seconds > 0)) return 0
  if (endsAt === null) return clamp(rest)
  return clamp((endsAt - now) / (seconds * 1000))
}

/** The whole seconds that are left, counted up (a timer says 1 until it is out), for a length in seconds and what is left of it */
export const secondsLeft = (left: number, seconds: number): number => Math.max(0, Math.ceil(Math.max(0, left) * Math.max(0, seconds) - 1e-9))

/** The sand for `left` of the time: how high it stands in the top bulb above the neck and across, how high the pile is in the bottom bulb and across its foot, and whether a thin stream of it is falling between the two */
export type Sand = {
  top: { height: number; radius: number }
  bottom: { height: number; radius: number }
  falling: boolean
}

export function sandAt(left: number, running: boolean): Sand {
  const rest = clamp(left)
  const top = TOP_REACH * Math.cbrt(rest)
  const bottom = PILE_HEIGHT * Math.cbrt(1 - rest)
  return {
    top: { height: top, radius: TOP_RADIUS * (top / TOP_REACH) },
    bottom: { height: bottom, radius: Math.min(PILE_WIDEST, PILE_SLOPE * bottom) },
    falling: running && rest > 0,
  }
}

/** How far into its warning the timer is, from 0 (not yet) to 1 (out of time): `warn` seconds before the end it begins, and the sand goes toward red as it goes. No warning when `warn` is not above zero */
export function dangerAt(left: number, seconds: number, warn: number): number {
  if (!(warn > 0) || !(seconds > 0)) return 0
  const remaining = clamp(left) * seconds
  return remaining >= warn ? 0 : clamp(1 - remaining / warn)
}
