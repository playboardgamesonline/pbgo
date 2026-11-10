/**
 * What a player answers in a window other than text: a number (a bet, a quantity, a bid) or a choice among a few options (a colour, a card to take, yes or no). Like the text of `cleanText`, an answer is checked in one place, on the
 * server, before it reaches a state, a log or another player's screen: the window of the board keeps the player to the range or the options, and the engine calls these on the field of the action, because only its answer counts.
 * A refusal is an `EngineError` with a code every game shares, which the platform words for the player.
 */
import { EngineError } from "./errors"

/** What a number must be like. Every field is optional */
export type NumberRules = {
  /** The least the number may be, itself included */
  min?: number
  /** The most, itself included */
  max?: number
  /** The steps the number goes by, counted from `min` (from 0 without one): a bid that goes up by 5 */
  step?: number
  /** A whole number (default true). A game that bets halves or tenths turns it off and gives a `step` */
  integer?: boolean
}

/**
 * The number a player chose, checked against the rules. Throws `EngineError("INVALID_NUMBER")` for anything that is not a finite number, a number that is not whole when it must be, one outside `min` and `max`, or one that is not on
 * a `step`. A string is not a number: an action carries numbers as numbers. Throws a `RangeError` for rules that no number could meet (a `min` above the `max`, a `step` that is not above zero): that is a bug of the game.
 */
export function cleanNumber(input: unknown, rules: NumberRules = {}): number {
  const { min, max, step, integer = true } = rules
  if (min !== undefined && max !== undefined && min > max) throw new RangeError(`No number is at least ${min} and at most ${max}`)
  if (step !== undefined && !(step > 0)) throw new RangeError(`A step is above zero, got ${String(step)}`)
  if (typeof input !== "number" || !Number.isFinite(input)) throw new EngineError("INVALID_NUMBER", "A number was expected")
  if (integer && !Number.isInteger(input)) throw new EngineError("INVALID_NUMBER", "A whole number was expected")
  if (min !== undefined && input < min) throw new EngineError("INVALID_NUMBER", "That number is too small")
  if (max !== undefined && input > max) throw new EngineError("INVALID_NUMBER", "That number is too big")
  if (step !== undefined) {
    const steps = (input - (min ?? 0)) / step
    if (Math.abs(steps - Math.round(steps)) > 1e-9) throw new EngineError("INVALID_NUMBER", "That number is not on a step")
  }
  // A -0 is a 0: it is the same bet and the same state
  return input === 0 ? 0 : input
}

/** What an option of a choice is: a string or a number, the same that the window offered */
export type ChoiceValue = string | number

/** The option a player chose, which must be one of `options`. Throws `EngineError("INVALID_CHOICE")` for anything else, a string for a number included */
export function cleanChoice<V extends ChoiceValue>(input: unknown, options: readonly V[]): V {
  if (!(options as readonly unknown[]).includes(input)) throw new EngineError("INVALID_CHOICE", "That is not one of the options")
  return input as V
}

/** How many options may be chosen at once: at least `min` (none by default) and at most `max` (all by default) */
export type ChoicesRules = { min?: number; max?: number }

/**
 * The options a player chose when they may choose several: an array of options with no option twice, as many as the rules allow. They are returned in the order of `options`, whatever the order they were sent in, so that the same
 * choice is the same state. Throws `EngineError("INVALID_CHOICE")` for anything that is not such an array.
 */
export function cleanChoices<V extends ChoiceValue>(input: unknown, options: readonly V[], rules: ChoicesRules = {}): V[] {
  const { min = 0, max = options.length } = rules
  if (min > max) throw new RangeError(`No choice has at least ${min} and at most ${max} options`)
  if (!Array.isArray(input) || input.length > options.length) throw new EngineError("INVALID_CHOICE", "A list of options was expected")
  const chosen = new Set<unknown>()
  for (const item of input) {
    if (!(options as readonly unknown[]).includes(item) || chosen.has(item)) throw new EngineError("INVALID_CHOICE", "That is not a list of different options")
    chosen.add(item)
  }
  if (chosen.size < min || chosen.size > max) throw new EngineError("INVALID_CHOICE", "That is not the number of options asked for")
  return options.filter((option) => chosen.has(option))
}
