// The words of Skyjo's board, plain data and the Studio kit's `fill` (a module with no import, which Node resolves as the browser does): read by the board (through the catalog), and by the tests that keep it equal to the Studio's `texts` and to the seed.

/**
 * The fields of the "Board" tab of the `texts` document in Sanity, under the same names: the words of the buttons and the labels over the piles (Draw, Take, Throw away, Deal), what the ticker says the viewer has to do (`prompt…`), the accessible name of a
 * card of the viewer's grid, what a seat says (the last turn, the points of the round), the announcements that are the game's own and the sentences of the history. Every one is written in Sanity, in every language; a word it does not have reads `[missing: <key>]`.
 */
export const WORD_FIELDS = [
  "draw",
  "takeDiscard",
  "throwAway",
  "deal",
  "promptReveal",
  "promptChoose",
  "promptPlaceDrawn",
  "promptPlaceTaken",
  "promptFlip",
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

/** A word with its placeholders filled in, and what it takes: the Studio kit's, the one function that the board and the Node-only content project of the game both read */
export { fill, type Values } from "@pbgo/studio-kit/fill"
