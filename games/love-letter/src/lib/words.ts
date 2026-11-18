// The words of Love Letter's board, plain data with no import: read by the board (through the catalog), and by the tests that keep it equal to the Studio's `texts` and to the seed.

/**
 * The fields of the "Board" tab of the `texts` document in Sanity, under the same names: the round and the tokens that win for the ticker, the announcement that is the game's own, the status of a player on their plate, and what the strip in the middle of the table says and
 * its pads. Every one is written in Sanity, in every language that has it; a word it does not have in the language asked reads in English, and one that English does not have either reads `[missing: <key>]`.
 */
export const WORD_FIELDS = [
  "round",
  "tokensToWin",
  "start",
  "out",
  "shielded",
  "roundWinner",
  "pickCard",
  "mustPlayCountess",
  "chooseOther",
  "chooseAny",
  "nameCharacter",
  "noTarget",
  "keepOne",
  "putBack",
  "play",
  "keep",
  "deal",
  "swap",
  "targetPlayer",
] as const

export type WordField = (typeof WORD_FIELDS)[number]
export type Vocabulary = Record<WordField, string>

/** What a word of the board takes in its `{placeholders}`: a number (`{number}`, the round), a count (`{count}`, the favor tokens that win) or a name (`{target}`, the player a zone chooses). */
export type Values = Record<string, string | number>

/** A word with its placeholders filled in. A placeholder with no value stays as written, so a mistake shows on the table instead of hiding. */
export const fill = (text: string, values: Values = {}) => text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match))
