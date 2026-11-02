import { internationalizedArray, type Language, type PluginConfig } from "sanity-plugin-internationalized-array"
import { DEFAULT_PLATFORM_LANGUAGE, PLATFORM_LANGUAGES } from "./constants"

// The translation of a document's fields, language by language (PLT-104): the configuration of `sanity-plugin-internationalized-array`
// that the platform's Studio uses, kept here so that a game's Studio can use the same one when it moves to this system. A translated field
// is an array of rows `{ language, value }`, and one row holds one language, so a document stays one document: its slug, its figures and
// its references are shared. This is its own entry point of the package, `@pbgo/studio-kit/field-translations`: the plugin is an optional
// peer, and a Studio that does not translate its fields this way never loads it.

export type FieldTranslationsOptions = {
  /**
   * The kinds of value that get a translated array, as the plugin's `fieldTypes` (a core type by its name, or a `defineField` for a custom
   * one, whose `name` names the types). `translatedType(kind)` of `constants.ts` is the type to give a field.
   */
  fieldTypes: PluginConfig["fieldTypes"]
  /** The document types the language filter is offered on: it shows only some of the languages of a document. */
  documentTypes: string[]
  /** Defaults to the languages of the platform's content, `PLATFORM_LANGUAGES`. */
  languages?: readonly Language[]
  /** The language that every translated field has a row for and falls back on. Defaults to English. */
  defaultLanguage?: string
}

/**
 * The plugin, set up for translating the fields of a Studio's documents:
 * - the default language has a row in every field of a new document, and that row cannot be removed: it is the text every other
 *   language falls back on. A row that is missing in an existing document is put back when the document is opened, which writes
 *   a draft of a published document: whatever writes a translated field (a migration, a seed) gives the default language its row, even
 *   an empty one, so that opening a document writes nothing;
 * - one "add translation" button per language under each field, and one for the whole document;
 * - the language filter, to show only some of the languages (English is always shown);
 * - the rows keep the order they were written in (`restoreOrder: false`): putting them back in the order of the languages would write
 *   a draft of a published document that is not in that order.
 */
export function fieldTranslations({ fieldTypes, documentTypes, languages = PLATFORM_LANGUAGES, defaultLanguage = DEFAULT_PLATFORM_LANGUAGE }: FieldTranslationsOptions) {
  return internationalizedArray({
    languages: [...languages],
    defaultLanguages: [defaultLanguage],
    allowRemovingDefaultLanguages: false,
    fieldTypes,
    buttonLocations: ["field", "document"],
    restoreOrder: false,
    languageFilter: { documentTypes, defaultLanguages: [defaultLanguage] },
  })
}
