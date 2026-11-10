import { type NumberRange, rangeOf, stepsIn, tidy } from "../stepper/steps"

/**
 * The arithmetic of a slider: how far along its rail a number is, which number a place on the rail means, and where the marks go. The rules are those of `cleanNumber` in the engine kit (the least, the most and the steps counted from the least), so
 * a number that the slider gives passes the engine's check with the same rules.
 */

const clamp = (value: number, least: number, most: number) => Math.min(most, Math.max(least, value))

/** How far along the rail a number is, from 0 at the least to 1 at the most: a range with one number is at 0, and a number outside the range is at the nearer end */
export function fractionOf(value: number, range: NumberRange = {}): number {
  const { min, max } = rangeOf(range)
  if (max <= min || !Number.isFinite(value)) return 0
  return clamp((value - min) / (max - min), 0, 1)
}

/** The number a place on the rail means: `fraction` is how far along it is, from 0 to 1, and the number is the one of the steps that is nearest to it, never above the last of the steps */
export function valueAt(fraction: number, range: NumberRange = {}): number {
  const rules = rangeOf(range)
  const steps = stepsIn(rules)
  if (steps <= 0 || !Number.isFinite(fraction)) return rules.min
  const near = Math.round((clamp(fraction, 0, 1) * (rules.max - rules.min)) / rules.step)
  return tidy(rules.min + clamp(near, 0, steps) * rules.step)
}

/** How far along the rail a point of the table is, in the units of the table, from its middle: negative toward the least. The rail lies along the x axis of its own frame, turned by `yaw` (radians about the vertical axis, counterclockwise from above) */
export function alongRail(point: { x: number; z: number }, middle: { x: number; z: number }, yaw = 0): number {
  return (point.x - middle.x) * Math.cos(yaw) - (point.z - middle.z) * Math.sin(yaw)
}

/**
 * The numbers that get a mark along the rail: all of them when there are `most` or fewer, else `most` of them spread evenly, each on a step, with the least and the highest the steps reach always marked. The marks of a rail with a hundred numbers
 * would be a comb: a handful is enough to read it by.
 */
export function marksOf(range: NumberRange = {}, most = 11): number[] {
  const rules = rangeOf(range)
  const steps = stepsIn(rules)
  if (steps <= 0) return [rules.min]
  const marks = Math.max(2, Math.floor(most))
  const at = (n: number) => tidy(rules.min + n * rules.step)
  if (steps + 1 <= marks) return Array.from({ length: steps + 1 }, (_, n) => at(n))
  return [...new Set(Array.from({ length: marks }, (_, k) => Math.round((steps * k) / (marks - 1))))].map(at)
}
