/** A number a counter shows on its way, and when it shows it: seconds after the change */
export type CountStep = { value: number; at: number }

export type CountOptions = {
  /** The most seconds a change takes to count */
  seconds: number
  /** The most seconds one number stays up, on average: a change of a few counts quickly, only a long one takes the whole `seconds` */
  tick: number
  /** The most numbers shown on the way: a jump of a hundred is not a hundred numbers */
  maxSteps: number
}

/**
 * The numbers a counter shows on its way from `from` to `to`, and when it shows each, the last being `to`. Whole numbers are shown one by one, thinned out to `maxSteps` when the change is long; they come quickly at first and ever slower, the way a
 * wheel stops. A change of one count shows at once, nearly. A change that is nothing has no step, and one that is not between whole numbers is a jump: the number is shown at once.
 */
export function countSteps(from: number, to: number, { seconds, tick, maxSteps }: CountOptions): CountStep[] {
  if (from === to) return []
  if (!Number.isInteger(from) || !Number.isInteger(to) || !Number.isFinite(from) || !Number.isFinite(to)) return [{ value: to, at: 0 }]
  const steps = Math.max(1, Math.min(Math.abs(to - from), Math.floor(maxSteps)))
  const total = Math.min(seconds, tick * steps)
  return Array.from({ length: steps }, (_, k) => {
    const done = (k + 1) / steps
    // The time at which a wheel that slows down evenly reaches this part of the way
    return { value: from + Math.round((to - from) * done), at: total * (1 - Math.sqrt(1 - done)) }
  })
}

/** What a change is called, with its sign: "+3", "−2" (the true minus sign). Nothing for a change that is nothing or is not a number */
export function changeText(change: number): string {
  if (!Number.isFinite(change) || change === 0) return ""
  return `${change > 0 ? "+" : "−"}${Math.abs(change)}`
}
