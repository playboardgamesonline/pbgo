import { LOCALES, type Locale } from "./i18n"

const OPEN = "[missing: "

/** What a required game text shows while Sanity holds no value for it: visible on the page, never a crash and never a copy kept in the code */
export const missing = (key: string) => `${OPEN}${key}]`

export const isMissing = (text: string) => text.startsWith(OPEN)

type Copy = {
  entries: { label: string; required: boolean; values: Record<Locale, string | null> }[]
  victoryPhrases: { values: Record<Locale, string[] | null> }
}

/**
 * The texts of a game that Sanity does not hold yet, as `label (languages)`: every required text of the Copy page, the victory phrases and
 * the description, in each language. Empty = players read nothing but what the game's owner wrote. The gamemaster's Launch lists them.
 */
export function missingTexts(copy: Copy, descriptions: Record<Locale, string>): string[] {
  const gaps = [
    ...copy.entries.filter((e) => e.required).map((e) => ({ label: e.label, languages: LOCALES.filter((l) => !e.values[l]) })),
    { label: "Victory phrases", languages: LOCALES.filter((l) => !copy.victoryPhrases.values[l]) },
    { label: "Description", languages: LOCALES.filter((l) => !descriptions[l]) },
  ]
  return gaps.filter((g) => g.languages.length).map((g) => `${g.label} (${g.languages.join(", ")})`)
}
