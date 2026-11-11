// The scorecard of the sheet specimen: the thirteen categories of Yahtzee and what the five dice score in each, and where each category stands on the sheet. Plain functions that import nothing, so that the controls and the scene both read them without
// pulling in three.js. The rules are the game's, not the table's: a `Sheet` only shows what its state says.

/** The categories, in the order of the card: the upper section, then the lower one. */
export const CATEGORIES = ["Ones", "Twos", "Threes", "Fours", "Fives", "Sixes", "Three of a kind", "Four of a kind", "Full house", "Small straight", "Large straight", "Yahtzee", "Chance"] as const

/** The rows of the card, from the top: the six of the upper section, the bonus, the seven of the lower section, the total. A category is a row, and the bonus and the total are rows that are written and never chosen. */
export const ROWS = 15
export const BONUS_ROW = 6
export const TOTAL_ROW = 14
/** The row of each category, and the category of each row (the bonus and the total have none). */
export const ROW_OF = CATEGORIES.map((_, category) => (category < 6 ? category : category + 1))
export const CATEGORY_OF: readonly (number | null)[] = Array.from({ length: ROWS }, (_, row) => (row === BONUS_ROW || row === TOTAL_ROW ? null : row < BONUS_ROW ? row : row - 1))
/** What the upper section must make for the bonus, and what the bonus is. */
export const BONUS = { needs: 63, worth: 35 }

const counts = (dice: readonly number[]) => {
  const found = [0, 0, 0, 0, 0, 0, 0]
  for (const die of dice) found[die] = (found[die] ?? 0) + 1
  return found
}

/** What five dice score in a category (a number from 0 to 12). */
export function scoreOf(category: number, dice: readonly number[]): number {
  const found = counts(dice)
  const sum = dice.reduce((total, die) => total + die, 0)
  const most = Math.max(...found)
  if (category >= 0 && category < 6) return (found[category + 1] ?? 0) * (category + 1)
  switch (category) {
    case 6:
      return most >= 3 ? sum : 0
    case 7:
      return most >= 4 ? sum : 0
    case 8:
      return found.includes(3) && found.includes(2) ? 25 : 0
    case 9:
      return [1, 2, 3].some((from) => [0, 1, 2, 3].every((step) => (found[from + step] ?? 0) > 0)) ? 30 : 0
    case 10:
      return [1, 2].some((from) => [0, 1, 2, 3, 4].every((step) => (found[from + step] ?? 0) > 0)) ? 40 : 0
    case 11:
      return most === 5 ? 50 : 0
    case 12:
      return sum
    default:
      throw new RangeError(`There is no category ${String(category)}`)
  }
}

/** What the upper section has made, and the bonus it has earned. */
export function upperOf(scores: readonly (number | null)[]): { sum: number; bonus: number } {
  const sum = scores.slice(0, 6).reduce<number>((total, score) => total + (score ?? 0), 0)
  return { sum, bonus: sum >= BONUS.needs ? BONUS.worth : 0 }
}

/** What the card makes in all, bonus included. */
export const totalOf = (scores: readonly (number | null)[]): number => scores.reduce<number>((total, score) => total + (score ?? 0), 0) + upperOf(scores).bonus
