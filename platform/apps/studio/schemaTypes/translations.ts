import { DEFAULT_PLATFORM_LANGUAGE, translatedRowType, translatedType } from "@pbgo/studio-kit/constants"
import { defineField } from "sanity"
import type { TranslatedKind } from "./constants"
import { checkDescriptions, checkNameTranslations, checkTranslations } from "./rules"

// The translated fields of the catalog (PLT-104): the kinds of value that get an array of rows `{ language, value }`, given to the plugin
// by `sanity.config.ts` (`fieldTranslations` of the studio kit). `TRANSLATED_FIELDS` of `constants.ts` says which field of which type is
// of which kind.

/** The language of a row of a translated field, from the `parent` a field is handed: the row itself. */
const languageOf = (row: unknown): unknown => (typeof row === "object" && row !== null ? (row as { language?: unknown }).language : undefined)

/**
 * The kinds, as the plugin's `fieldTypes`, in the order of `TRANSLATED_KINDS`:
 * - `description` is a long text (8 rows), and `checkDescriptions` keeps each language to `DESCRIPTION_MAX` characters (a rule of the field, not
 *   of the type: the plugin hands the rules of a type to the row, an object, which a length would measure as a whole);
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

/** The empty row of English, which every translated field has. */
export const englishRow = (kind: TranslatedKind) => ({ _key: DEFAULT_PLATFORM_LANGUAGE, _type: translatedRowType(kind), language: DEFAULT_PLATFORM_LANGUAGE })

type TranslatedFieldDefinition = { name: string; title: string; kind: TranslatedKind; group?: string; options?: { hotspot?: boolean } }

/**
 * A translated field of the catalog: the type of its kind, the rules of the translations (`checkTranslations`, or `checkNameTranslations`
 * for a name: nothing is required, English comes first) and, for a new document, the empty row of English as its initial value.
 *
 * That last part is what keeps a published document from being written to when it is opened. The plugin puts a missing row of English back
 * when a document is opened, but only in the fields the form shows, which for a document in tabs are the fields of the open tab: a document
 * made and published while only its first tab was open would otherwise lack the row in the other tabs, and opening it on one of them later
 * would make a draft of it. With the row in the initial value, a new document has all its rows from the start.
 */
export const translatedField = ({ name, title, kind, group, options }: TranslatedFieldDefinition) =>
  defineField({
    name,
    title,
    type: translated(kind),
    ...(group ? { group } : {}),
    ...(options ? { options } : {}),
    initialValue: [englishRow(kind)],
    validation: (rule) => rule.custom(kind === "localizedName" ? checkNameTranslations : kind === "description" ? checkDescriptions : checkTranslations),
  })
