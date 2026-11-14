import { CELLS, COLUMNS, ROWS } from "./types"

/**
 * What the cards of a grid are worth. Pure: it reads values, never a state.
 *
 * Rulebook, page 3: a player's total for the round is the sum of their cards, negative cards included. The player who ended the round
 * has that total doubled when it is not strictly the lowest of the round, but only when it is positive ("this rule only applies to positive points").
 */

/** The cells of `column`, in order from top to bottom. */
export function columnCells(column: number): number[] {
  return Array.from({ length: ROWS }, (_, row) => column * ROWS + row)
}

/** The column of a cell. */
export function columnOf(position: number): number {
  return Math.floor(position / ROWS)
}

/** True for an integer that names a cell of a grid. */
export function isPosition(position: unknown): position is number {
  return typeof position === "number" && Number.isInteger(position) && position >= 0 && position < CELLS
}

/** The columns of a grid, by number (for loops that read them). */
export const COLUMN_NUMBERS: readonly number[] = Array.from({ length: COLUMNS }, (_, column) => column)

/** Three cards that are all the same value: the column is thrown away (rulebook, page 2). */
export function isTriple(values: readonly number[]): boolean {
  return values.length === ROWS && values.every((value) => value === values[0])
}

/** The sum of some values. */
export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/**
 * What each seat scores in a round from the value of its grid, and who ended it: the sums, with the ender's doubled when it is positive and
 * not strictly lower than every other sum (a tie for the lowest doubles it). `ender: null` is a round nobody ended: no doubling.
 */
export function roundScores(sums: readonly number[], ender: number | null): { scores: number[]; doubled: boolean } {
  if (ender === null) return { scores: [...sums], doubled: false }
  const mine = sums[ender]!
  const strictlyLowest = sums.every((other, seat) => seat === ender || mine < other)
  const doubled = mine > 0 && !strictlyLowest
  return { scores: sums.map((value, seat) => (seat === ender && doubled ? value * 2 : value)), doubled }
}
