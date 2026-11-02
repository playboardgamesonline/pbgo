import { DEFAULT_PLATFORM_LANGUAGE, translatedType } from "@pbgo/studio-kit/constants"
import { defineField } from "sanity"
import type { TranslatedKind } from "./constants"

// The translated fields of the catalog (PLT-104): the kinds of value that get an array of rows `{ language, value }`, given to the plugin
// by `sanity.config.ts` (`fieldTranslations` of the studio kit). `TRANSLATED_FIELDS` of `constants.ts` says which field of which type is
// of which kind.

/** The language of a row of a translated field, from the `parent` a field is handed: the row itself. */
const languageOf = (row: unknown): unknown => (typeof row === "object" && row !== null ? (row as { language?: unknown }).language : undefined)

/**
 * The kinds, as the plugin's `fieldTypes`, in the order of `TRANSLATED_KINDS`:
 * - `description` is a long text (8 rows);
 * - `localizedName` is the name of a game in a language. English is the `name` of the game, so the row of English is read-only and `rules.ts`
 *   refuses a value in it: a second English name would be one more way to disagree.
 */
export const TRANSLATED_FIELD_TYPES = [
  "string",
  "url",
  "image",
  defineField({ name: "description", type: "text", rows: 8 }),
  defineField({ name: "localizedName", type: "string", readOnly: ({ parent }) => languageOf(parent) === DEFAULT_PLATFORM_LANGUAGE }),
] satisfies (string | ReturnType<typeof defineField>)[]

/** The type of a translated field of this kind: what a field is given as its `type`. */
export const translated = (kind: TranslatedKind): string => translatedType(kind)
