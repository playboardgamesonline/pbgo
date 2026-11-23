// The words of Flip 7's board, plain data with no import: read by the board (through the catalog), and by the tests that keep it equal to the Studio's `texts` and to the seed.

/**
 * The fields of the "Board" tab of the `texts` document in Sanity, under the same names: the buttons (`hit`, `stay`, `deal`), what the holder of an action card is told in the ticker (`target…`, one for each action card, and `targetPlayer`, the accessible name of a player's area), the status of a player, the two announcements that are the game's own and the sentences of
 * the history. Every one is written in Sanity, in every language; a word it does not have reads `[missing: <key>]`.
 */
export const WORD_FIELDS = [
  "hit",
  "stay",
  "deal",
  "targetFreeze",
  "targetFlipThree",
  "targetSecondChance",
  "targetPlayer",
  "round",
  "firstTo",
  "busted",
  "frozen",
  "stayed",
  "start",
  "flip7",
  "eventRound",
  "eventDeal",
  "eventHit",
  "eventFlip",
  "eventStay",
  "eventBust",
  "eventSaved",
  "eventPlay",
  "eventKeep",
  "eventDiscarded",
  "eventReshuffle",
  "eventFlip7",
  "eventEnd",
  "eventOver",
] as const

export type WordField = (typeof WORD_FIELDS)[number]
export type Vocabulary = Record<WordField, string>

/** What the holder of an action card is told, in the game's words: the one sentence for each action card, which the ticker says under whose turn it is (the table writes no sentence) */
export const targetPromptOf = (type: string, words: Pick<Vocabulary, "targetFreeze" | "targetFlipThree" | "targetSecondChance">) =>
  type === "freeze" ? words.targetFreeze : type === "flip-three" ? words.targetFlipThree : words.targetSecondChance

/** What a word of the board takes in its `{placeholders}`: the name of a player (`{target}`), a card (`{card}`: its figure, or the name of an action card), a number (`{number}`) or a count of points (`{points}`). */
export type Values = Record<string, string | number>

/** A word with its placeholders filled in. A placeholder with no value stays as written, so a mistake shows on the table instead of hiding. */
export const fill = (text: string, values: Values = {}) => text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match))
