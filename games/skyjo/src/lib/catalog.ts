import { CARDS } from "@skyjo/engine"
import { missing } from "@pbgo/core/lib/missing"
import { type Vocabulary, WORD_FIELDS } from "./words"

/**
 * What the board shows from Sanity: no text and no picture comes from the code. A text Sanity does not have reads `[missing: <key>]`; a picture it does not have is `null` and the table draws a
 * stand-in, so what is missing stays in sight instead of being covered by a copy kept here.
 */
export type ClientCatalog = {
  /** The picture of each card, by its key in the engine's catalogue (`card-7`, `card-minus-2`): the `image` of its document in Sanity, `null` while it has none */
  faces: Record<string, string | null>
  /** The back of every card: `cardBack` of the `game` document */
  backUrl: string | null
  /** The words of the board (`WORD_FIELDS`), in the language asked */
  words: Vocabulary
}

/** The catalog when Sanity has not answered (or the game has no project): every text is a visible marker and there is no picture. */
export const MISSING_CATALOG: ClientCatalog = {
  faces: Object.fromEntries(Object.keys(CARDS).map((key) => [key, null])),
  backUrl: null,
  words: Object.fromEntries(WORD_FIELDS.map((field) => [field, missing(field)])) as Vocabulary,
}
