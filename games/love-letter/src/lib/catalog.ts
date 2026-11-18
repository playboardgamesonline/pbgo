import { CHARACTER_KEYS, type CharacterKey } from "@love-letter/engine"
import { missing } from "@pbgo/core/lib/missing"
import { type Vocabulary, WORD_FIELDS } from "./words"

/** One value for each of the ten characters, by their key in the engine's catalogue. */
const byKey = <T>(make: (key: CharacterKey) => T) => Object.fromEntries(CHARACTER_KEYS.map((key) => [key, make(key)])) as Record<CharacterKey, T>

/**
 * What the board shows from Sanity: no text and no picture comes from the code. A text Sanity does not have reads `[missing: <key>]`; a picture it does not have is `null` and the table draws a stand-in, so what is missing stays in sight instead of
 * being covered by a copy kept here.
 */
export type ClientCatalog = {
  /** The face of each character, by its key in the engine's catalogue: the `image` of its `character` document in Sanity, `null` while it has none. A blank plate: the board draws the name and the card text over it */
  faces: Record<CharacterKey, string | null>
  /** The name of each character, in the language asked: the `name` of its document */
  names: Record<CharacterKey, string>
  /** The card text of each character, in the language asked: the `text` of its document, drawn in the plate of its face */
  texts: Record<CharacterKey, string>
  /** The back of every card: `cardBack` of the `game` document */
  backUrl: string | null
  /** The words of the board (`WORD_FIELDS`), in the language asked */
  words: Vocabulary
}

/** The catalog when Sanity has not answered (or the game has no project): every text is a visible marker and there is no picture. */
export const MISSING_CATALOG: ClientCatalog = {
  faces: byKey(() => null),
  names: byKey((key) => missing(`characters.${key}.name`)),
  texts: byKey((key) => missing(`characters.${key}.text`)),
  backUrl: null,
  words: Object.fromEntries(WORD_FIELDS.map((field) => [field, missing(field)])) as Vocabulary,
}
