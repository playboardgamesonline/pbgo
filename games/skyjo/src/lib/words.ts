// The words of Skyjo's board, plain data with no import: read by the board (through the catalog), and by the tests that keep it equal to the Studio's `texts` and to the seed.

/**
 * The fields of the "Board" tab of the `texts` document in Sanity, under the same names: the three floor buttons and Deal, what is written flat on the table for the instruction of the moment (`prompt…`), the accessible name of a
 * card of the viewer's grid, what a seat says (the last turn, the points of the round), the announcements that are the game's own and the sentences of the history. Every one is written in Sanity, in every language; a word it does not have reads `[missing: <key>]`.
 */
export const WORD_FIELDS = [
  "draw",
  "takeDiscard",
  "throwAway",
  "deal",
  "promptReveal",
  "promptRevealWait",
  "promptChoose",
  "promptPlaceDrawn",
  "promptPlaceTaken",
  "promptFlip",
  "promptWait",
  "promptBetween",
  "promptDeal",
  "cell",
  "lastTurn",
  "ended",
  "roundPoints",
  "roundPointsDoubled",
  "round",
  "endsAt",
  "start",
  "lastTurnAnnouncement",
  "eventRound",
  "eventReveal",
  "eventTake",
  "eventDraw",
  "eventDrawSeen",
  "eventPlace",
  "eventThrow",
  "eventFlip",
  "eventColumn",
  "eventStart",
  "eventLast",
  "eventReshuffle",
  "eventEnd",
  "eventEndDoubled",
  "eventOver",
] as const

export type WordField = (typeof WORD_FIELDS)[number]
export type Vocabulary = Record<WordField, string>

/** What a word of the board takes in its `{placeholders}`: the name of a player (`{player}`), a card (`{card}`, `{replaced}`: the figure on it), a number (`{number}`, `{column}`, `{row}`, `{value}`, `{sum}`) or a count of points (`{points}`). */
export type Values = Record<string, string | number>

/** A word with its placeholders filled in. A placeholder with no value stays as written, so a mistake shows on the table instead of hiding. */
export const fill = (text: string, values: Values = {}) => text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match))
