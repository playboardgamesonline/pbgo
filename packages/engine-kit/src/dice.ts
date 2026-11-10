/**
 * Dice. A roll is a draw from the game's seeded stream, like a shuffle: the same seed and the same actions give the same dice on every machine, and a client that reads the view cannot
 * know the next roll, because the position of the stream (`Rng.save()`) never leaves the state. The engine rolls inside `apply`, keeps the values in its state and says the roll as an event
 * of its log; the board draws it with the `Die` of `@pbgo/table` and lets it tumble onto the value the engine gave.
 *
 * A value is the number of the face that lies up, from 1 to `sides`. A die with pictures instead of numbers (King of Tokyo, Zombie Dice) rolls the same way and reads its picture from a
 * list of its own: `faces[value - 1]`.
 */
import type { Rng } from "./rng"

/** A die has two sides at the least, and a whole number of them. */
function checkSides(sides: number): void {
  if (!Number.isInteger(sides) || sides < 2) throw new RangeError(`A die has a whole number of sides, two at the least, got ${String(sides)}`)
}

/** One roll of a die: a whole number from 1 to `sides` (six by default). Draws one number from `rng`. */
export function rollDie(rng: Rng, sides = 6): number {
  checkSides(sides)
  return 1 + Math.floor(rng() * sides)
}

/** `count` dice rolled one after the other, in order: the same as that many `rollDie` in a row. A count of zero rolls nothing and draws nothing. */
export function rollDice(rng: Rng, count: number, sides = 6): number[] {
  checkSides(sides)
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`A pool holds a whole number of dice, got ${String(count)}`)
  return Array.from({ length: count }, () => rollDie(rng, sides))
}

/**
 * A pool rolled again: the dice at the indexes of `reroll` are rolled, in the order of their index whatever the order they were listed in, and the others keep their value (Yahtzee, King of Tokyo,
 * Can't Stop). Returns a new pool and leaves `dice` alone. An index that is not a die of the pool, or that is listed twice, is a bug of the game, which checks what the player sent before it gets here:
 * it throws a `RangeError`.
 */
export function rerollDice(rng: Rng, dice: readonly number[], reroll: Iterable<number>, sides = 6): number[] {
  checkSides(sides)
  const indexes = [...reroll]
  const seen = new Set<number>()
  for (const index of indexes) {
    if (!Number.isInteger(index) || index < 0 || index >= dice.length) throw new RangeError(`There is no die ${String(index)} in a pool of ${dice.length}`)
    if (seen.has(index)) throw new RangeError(`Die ${index} is rolled twice`)
    seen.add(index)
  }
  const next = [...dice]
  for (const index of [...seen].sort((a, b) => a - b)) next[index] = rollDie(rng, sides)
  return next
}
