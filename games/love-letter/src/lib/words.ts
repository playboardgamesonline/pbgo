// The words of Love Letter's board, plain data and the Studio kit's `fill` (a module with no import, which Node resolves as the browser does): read by the board (through the catalog), and by the tests that keep it equal to the Studio's `texts` and to the seed.

/**
 * The fields of the "Board" tab of the `texts` document in Sanity, under the same names: the round and the tokens that win for the ticker, the announcement that is the game's own, the status of a player on their plate, and what the strip in the middle of the table says and
 * what the ticker says to do and its button, and one sentence for each event of the log, for the history of the ticker. Every one is written in Sanity, in every language that has it; a word it does not have in the language asked reads in English, and one that English does not have either reads `[missing: <key>]`.
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
  "keepOne",
  "putBack",
  "play",
  "keep",
  "deal",
  "targetPlayer",
  "eventRound",
  "eventDraw",
  "eventPlay",
  "eventGuessHit",
  "eventGuessMiss",
  "eventLook",
  "eventCompare",
  "eventSwap",
  "eventProtect",
  "eventDiscard",
  "eventDiscardSelf",
  "eventOutGuard",
  "eventOutBaron",
  "eventOutPrincess",
  "eventChancellor",
  "eventBottom",
  "eventFizzled",
  "eventReveal",
  "eventEnd",
  "eventSpy",
  "eventOver",
  "outOfRound",
] as const

export type WordField = (typeof WORD_FIELDS)[number]
export type Vocabulary = Record<WordField, string>

/** A word with its placeholders filled in, and what it takes: the Studio kit's, the one function that the board and the Node-only content project of the game both read */
export { fill, type Values } from "@pbgo/studio-kit/fill"
