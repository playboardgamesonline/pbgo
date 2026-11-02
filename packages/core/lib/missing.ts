import { DEFAULT_LOCALE, LOCALES, type Locale } from "./i18n"

const OPEN = "[missing: "

/** What a required game text shows while Sanity holds no value for it: visible on the page, never a crash and never a copy kept in the code */
export const missing = (key: string) => `${OPEN}${key}]`

export const isMissing = (text: string) => text.startsWith(OPEN)

type Copy = {
  entries: { label: string; required: boolean; values: Record<Locale, string | null> }[]
  victoryPhrases: { values: Record<Locale, string[] | null> }
}

/**
 * The languages in which a text reads as missing. A language with no value of its own reads English, the default language and the fallback of every text (`translate`), so nothing is
 * missing anywhere while English has a value. Without one, a language with none of its own reads `[missing: <key>]` (nothing, for a text that is optional) and the others still read theirs.
 */
export function gapsOf(values: Record<Locale, unknown>): Locale[] {
  return values[DEFAULT_LOCALE] ? [] : LOCALES.filter((l) => !values[l])
}

/**
 * The texts of a game that Sanity does not hold yet, as `label (languages)`: every required text of the Copy page, the victory phrases and
 * the description, in the languages that would read a gap (`gapsOf`). Empty = players read nothing but what the game's owner wrote. The gamemaster's Launch lists them.
 */
export function missingTexts(copy: Copy, descriptions: Record<Locale, string>): string[] {
  const gaps = [
    ...copy.entries.filter((e) => e.required).map((e) => ({ label: e.label, languages: gapsOf(e.values) })),
    { label: "Victory phrases", languages: gapsOf(copy.victoryPhrases.values) },
    { label: "Description", languages: gapsOf(descriptions) },
  ]
  return gaps.filter((g) => g.languages.length).map((g) => `${g.label} (${g.languages.join(", ")})`)
}
