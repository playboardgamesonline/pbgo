/**
 * Counters. A counter is a number of the state that goes up and down between two ends: the life of a player, the coins of a reserve, the clue tokens that are left, the victory points. The engine changes it inside `apply` and says the change as
 * an event of its log; the board draws it with a `Counter` that counts up or down to the number it is given.
 *
 * What a change does when it meets an end is the rule of the game, and the helper says what happened so that the rule can go on from there: damage that would take a player's life under zero leaves it at zero, and the log says how much of the
 * damage was really taken.
 */

/** The ends of a counter. Both are optional: a reserve of coins has a least and no most */
export type CounterRules = {
  /** The least the counter may be, itself included */
  min?: number
  /** The most, itself included */
  max?: number
}

/** What a change did */
export type Change = {
  /** Where the counter was */
  from: number
  /** Where it is now */
  to: number
  /** What changed, with its sign. An end of the counter can cut the change short, so this may be less than what was asked */
  applied: number
  /** The end that cut the change short, when one did: reaching an end exactly is not being cut short */
  stopped: "min" | "max" | null
}

/** A zero is a zero: a state that holds -0 is not the state that holds 0, once it has been through JSON */
const clean = (value: number) => (value === 0 ? 0 : value)

/**
 * A counter changed by `delta`, held between the ends of `rules`. Returns where it ended and what was really applied, and which end stopped it if one did. A counter that is not in its ends to begin with, an end above the other and a value
 * or a change that is not a finite number throw a `RangeError`: they are bugs of the game, not moves of a player (what a player sends is checked with `cleanNumber` first).
 */
export function changeCounter(rules: CounterRules, value: number, delta: number): Change {
  const { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = rules
  if (min > max) throw new RangeError(`A counter cannot go from ${min} to ${max}`)
  if (!Number.isFinite(value)) throw new RangeError(`A counter holds a finite number, got ${String(value)}`)
  if (!Number.isFinite(delta)) throw new RangeError(`A counter changes by a finite number, got ${String(delta)}`)
  if (value < min || value > max) throw new RangeError(`A counter at ${value} is outside its ends, ${min} to ${max}`)
  const asked = value + delta
  const to = Math.min(max, Math.max(min, asked))
  return { from: clean(value), to: clean(to), applied: clean(to - value), stopped: asked > max ? "max" : asked < min ? "min" : null }
}
