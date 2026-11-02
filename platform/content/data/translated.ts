import { DEFAULT_PLATFORM_LANGUAGE, PLATFORM_LANGUAGES, translatedRowType } from "@pbgo/studio-kit/constants"
import type { SeedDoc } from "@pbgo/content-kit"
import { TRANSLATED_FIELDS, type TranslatedDocumentType, type TranslatedKind } from "../../apps/studio/schemaTypes/constants.ts"

// The translated fields of the catalog (PLT-104) as the seed writes them: an array of rows `{ _key, _type, language, value }`, a row per
// language that has a value. The key of a row is its language, so that the seed finds the same row again (the rows the Studio adds have
// keys of their own: the seed's merge finds them by language, `@pbgo/content-kit`).

/** The row of a language in a translated field of this kind. */
export const translatedRow = (kind: TranslatedKind, language: string, value: unknown): Record<string, unknown> => ({ _key: language, _type: translatedRowType(kind), language, value })

/**
 * The rows of a translated field made of the values a source has per language: a row for each language of the platform that has a value, in
 * the order of the platform's languages (English first). None when no language has one: the seed writes no empty value (`withEnglishRows`
 * gives such a field its empty row of English).
 */
export function translatedRows(kind: TranslatedKind, values: Partial<Record<string, string>>): Record<string, unknown>[] {
  return PLATFORM_LANGUAGES.flatMap(({ id }) => {
    const value = values[id]
    return value ? [translatedRow(kind, id, value)] : []
  })
}

/**
 * A catalog document with the row of English in each of its translated fields, an empty one where the source has nothing (Notion has no
 * tagline, cover, box or name in another language). The plugin of the Studio puts a missing row of English back when a document is opened,
 * but only in the fields of the open tab, and in a published document that is a draft made just by opening it: so whatever writes a
 * translated field gives English its row (`docs/platform-sanity.md`). An empty row is no value: the merge of the seed finds a row by its
 * language and fills its value later, and never overwrites one.
 */
export function withEnglishRows<T extends SeedDoc>(doc: T): T {
  const fields: Record<string, TranslatedKind> | undefined = TRANSLATED_FIELDS[doc._type as TranslatedDocumentType]
  for (const [name, kind] of Object.entries(fields ?? {})) {
    const rows = Array.isArray(doc[name]) ? (doc[name] as { language?: unknown }[]) : []
    if (!rows.some((row) => row.language === DEFAULT_PLATFORM_LANGUAGE)) {
      const row = { _key: DEFAULT_PLATFORM_LANGUAGE, _type: translatedRowType(kind), language: DEFAULT_PLATFORM_LANGUAGE }
      ;(doc as Record<string, unknown>)[name] = [row, ...rows]
    }
  }
  return doc
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
