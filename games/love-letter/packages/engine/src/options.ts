import type { OptionDefinitions } from "@pbgo/engine-kit"

/** Love Letter has no option: the standard game as the booklet has it, for 2 to 6 players. The classic version (p. 14) is out of scope. */
export const OPTIONS: OptionDefinitions = {}

/** The favor tokens that win the game, by number of players: 6, 5, 4, 3 and 3 for 2 to 6 players (rulebook, p. 7). The rules fix them; no option moves them. */
const TOKENS_TO_WIN: Readonly<Record<number, number>> = { 2: 6, 3: 5, 4: 4, 5: 3, 6: 3 }

/** How many favor tokens a player needs to win a game of `players`. A table the game does not seat is a bug of the game: `setup` refuses it first. */
export function tokensToWin(players: number): number {
  const tokens = Object.hasOwn(TOKENS_TO_WIN, players) ? TOKENS_TO_WIN[players] : undefined
  if (tokens === undefined) throw new RangeError(`There is no game of ${players} players: the booklet has 2 to 6`)
  return tokens
}
