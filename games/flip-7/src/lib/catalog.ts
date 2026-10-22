import { missing } from "@pbgo/core/lib/missing"

/**
 * The words of the board: one field of the Studio's `texts` each (Texts › Board), in every language. The game keeps no wording in its
 * code: a word Sanity does not hold reads `[missing: <field>]` on the table. `{name}`, `{card}`… in a word are filled by the board.
 */
export const WORD_FIELDS = [
  "hit",
  "stay",
  "deal",
  "round",
  "goal",
  "deck",
  "discard",
  "dealer",
  "stayed",
  "frozen",
  "busted",
  "scoreNow",
  "scoreTotal",
  "setAside",
  "targetPrompt",
  "targetOther",
  "dealMine",
  "dealOther",
  "evHit",
  "evFlipped",
  "evBust",
  "evSaved",
  "evStay",
  "evGive",
  "evGiveSelf",
  "evDiscarded",
  "evReshuffle",
  "evFlip7",
  "detailRounds",
  "detailBestRound",
  "detailFlip7",
  "detailBusts",
  "flip7Banner",
] as const

export type Word = (typeof WORD_FIELDS)[number]
export type Vocabulary = Record<Word, string>

/** What the board draws of a face: its picture (null when Sanity has none) and, for an action card, its name in the visitor's language. */
export type FaceInfo = { name: string | null; imageUrl: string | null }

/** What `loadGameData` hands to the board: the words, the faces by the engine's face type, the table and the back of a card. */
export type ClientCatalog = {
  words: Vocabulary
  faces: Record<string, FaceInfo>
  matUrl: string | null
  cardBackUrl: string | null
}

/** Nothing from Sanity: every word is a visible marker, no picture. The board still plays. */
export const MISSING_CATALOG: ClientCatalog = {
  words: Object.fromEntries(WORD_FIELDS.map((field) => [field, missing(field)])) as Vocabulary,
  faces: {},
  matUrl: null,
  cardBackUrl: null,
}

export type CardCategory = "number" | "action" | "modifier"

/** The engine's face type of a card filed in the Studio under its category and its simplest key (`7` of the numbers is `number-7`; `freeze` and `plus-4` are themselves). */
export const faceTypeOf = (category: CardCategory, key: string) => (category === "number" ? `number-${key}` : key)
