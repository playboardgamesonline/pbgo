import { DEFAULT_PLATFORM_LANGUAGE, PLATFORM_LANGUAGES, translatedRowType } from "@pbgo/studio-kit/constants"
import type { SeedDoc } from "@pbgo/content-kit"
import { TRANSLATED_FIELDS, type TranslatedKind } from "../../apps/studio/schemaTypes/constants.ts"

// The translated fields of the catalog (PLT-104) as the seed writes them: an array of rows `{ _key, _type, language, value }`, a row per
// language that has a value. The key of a row is its language, so that the seed finds the same row again (the rows the Studio adds have
// keys of their own: the seed's merge finds them by language, `@pbgo/content-kit`).

/** The row of a language in a translated field of this kind. */
export const translatedRow = (kind: TranslatedKind, language: string, value: unknown): Record<string, unknown> => ({ _key: language, _type: translatedRowType(kind), language, value })

/**
 * The rows of a translated field made of the values a source has per language: a row for each language of the platform that has a value, in
 * the order of the platform's languages (English first). None when no language has one: the seed writes no empty value, and a field with no
 * row is left to the Studio (which gives every field its row of English when somebody opens it).
 */
export function translatedRows(kind: TranslatedKind, values: Partial<Record<string, string>>): Record<string, unknown>[] {
  return PLATFORM_LANGUAGES.flatMap(({ id }) => {
    const value = values[id]
    return value ? [translatedRow(kind, id, value)] : []
  })
}

/**
 * The documents that have a language in a translated field but no English: English is what every language falls back on, so the Studio
 * refuses to publish such a document (`checkTranslations`). The seed writes what its source has and guesses nothing, so it says which
 * (the source has a description in French and none in English): to settle in the source, or in the Studio.
 */
export function missingEnglish(docs: readonly SeedDoc[]): string[] {
  const gaps: string[] = []
  for (const doc of docs) {
    const fields = TRANSLATED_FIELDS[doc._type as keyof typeof TRANSLATED_FIELDS]
    for (const name of Object.keys(fields ?? {})) {
      const rows = Array.isArray(doc[name]) ? (doc[name] as { language?: unknown; value?: unknown }[]) : []
      const filled = rows.filter((row) => row.value !== undefined && row.value !== "").map((row) => String(row.language))
      if (filled.length > 0 && !filled.includes(DEFAULT_PLATFORM_LANGUAGE)) gaps.push(`${doc._id}: ${name} is in ${filled.join(", ")} and not in English`)
    }
  }
  return gaps
}
