/**
 * The arithmetic of a stepper: which number an arrow gives, and when a held arrow repeats. The rules are those of `cleanNumber` in the engine kit (the least, the most and the steps counted from the least), so a number that
 * the stepper gives passes the engine's check with the same rules.
 */

export type NumberRange = {
  /** The least the number may be (default 0) */
  min?: number
  /** The most the number may be (default 99) */
  max?: number
  /** What each press adds or takes away, and what the numbers between `min` and `max` go by (default 1) */
  step?: number
}

/** The range with its defaults filled in, and kept sane: a step that is not above zero is 1, and an end that is before the other is the other */
export function rangeOf({ min = 0, max = 99, step = 1 }: NumberRange = {}): Required<NumberRange> {
  const least = Number.isFinite(min) ? min : 0
  const most = Number.isFinite(max) ? Math.max(least, max) : least
  return { min: least, max: most, step: Number.isFinite(step) && step > 0 ? step : 1 }
}

/** A number cleaned of the dust of floating point: 0.1 + 0.2 is 0.3 */
export const tidy = (value: number) => Math.round(value * 1e9) / 1e9

/** How many steps there are from the least number to the most */
export const stepsIn = ({ min, max, step }: Required<NumberRange>) => Math.floor(tidy((max - min) / step))

/** The number a press of an arrow gives: one step up (`1`) or down (`-1`) from `value`, kept to the range. A number that is off the steps is put on them first, and one outside the range comes into it */
export function stepped(value: number, direction: 1 | -1, range: NumberRange = {}): number {
  const rules = rangeOf(range)
  const from = Number.isFinite(value) ? Math.round((value - rules.min) / rules.step) : 0
  const to = Math.min(stepsIn(rules), Math.max(0, from + direction))
  return tidy(rules.min + to * rules.step)
}

/** Whether a press of the arrow of `direction` would change the number: an arrow at the end of the range does nothing */
export function canStep(value: number, direction: 1 | -1, range: NumberRange = {}): boolean {
  return stepped(value, direction, range) !== value
}

/** How a held arrow repeats, in seconds */
export type Repeat = {
  /** The wait before the first repeat */
  delay: number
  /** The wait between the first repeats */
  every: number
  /** The least wait between two repeats, which they speed up to */
  fastest: number
  /** What each wait is multiplied by to get the next: below 1, the repeats come faster and faster */
  faster: number
}

/** The wait, in seconds, before the repeat number `index` of a held arrow (0 for the first), counted from the press or from the repeat before it: the first waits `delay`, then they come `every`, each quicker than the last down to `fastest` */
export function repeatAfter(index: number, { delay, every, fastest, faster }: Repeat): number {
  if (index <= 0) return Math.max(0, delay)
  return Math.max(fastest, every * faster ** (index - 1))
}
