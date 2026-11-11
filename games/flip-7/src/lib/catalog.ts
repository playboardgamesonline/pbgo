import { CARDS } from "@flip-7/engine"
import { missing } from "@pbgo/core/lib/missing"
import { type Vocabulary, WORD_FIELDS } from "./words"

/** The action cards of the engine's catalogue: the only cards named by words (a number or a modifier is named by the figure printed on it, which the catalogue holds). */
export const ACTION_KEYS = Object.keys(CARDS).filter((key) => CARDS[key as keyof typeof CARDS].kind === "action")

/** The key a card of the Studio has in the engine's catalogue: the Studio lists a number under its figure and the engine calls it `number-<figure>`; the other two kinds keep their key. */
export const engineKeyOf = (type: "numberCard" | "actionCard" | "modifierCard", key: string) => (type === "numberCard" ? `number-${key}` : key)

/**
 * What the board shows from Sanity: no text and no picture comes from the code. A text Sanity does not have reads `[missing: <key>]`; a picture it does not have is `null` and the table draws a
 * stand-in, so what is missing stays in sight instead of being covered by a copy kept here.
 */
export type ClientCatalog = {
  /** The picture of each card, by its key in the engine's catalogue (`number-7`, `plus-4`, `freeze`): the `image` of its document in Sanity, `null` while it has none */
  faces: Record<string, string | null>
  /** The name of each action card, in the language asked */
  names: Record<string, string>
  /** The back of every card: `cardBack` of the `game` document */
  backUrl: string | null
  /** The words of the board (`WORD_FIELDS`), in the language asked */
  words: Vocabulary
}

/** The catalog when Sanity has not answered (or the game has no project): every text is a visible marker and there is no picture. */
export const MISSING_CATALOG: ClientCatalog = {
  faces: Object.fromEntries(Object.keys(CARDS).map((key) => [key, null])),
  names: Object.fromEntries(ACTION_KEYS.map((key) => [key, missing(`cards.${key}`)])),
  backUrl: null,
  words: Object.fromEntries(WORD_FIELDS.map((field) => [field, missing(field)])) as Vocabulary,
}
