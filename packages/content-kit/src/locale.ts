import { LANGUAGES } from "@pbgo/studio-kit/constants"

export type LanguageId = (typeof LANGUAGES)[number]["id"]

/** One text per site language: adding a language to `LANGUAGES` makes every builder call below fail to typecheck. */
export type Localized = Record<LanguageId, string>

export const LANGUAGE_IDS: LanguageId[] = LANGUAGES.map((language) => language.id)

const preview = (values: Localized) => JSON.stringify(values.fr ?? Object.values(values)[0] ?? "").slice(0, 60)

function checked(kind: "localeString" | "localeText", values: Localized): Localized {
  const out = {} as Localized
  for (const id of LANGUAGE_IDS) {
    const value = values[id]
    if (typeof value !== "string" || !value.trim()) throw new Error(`${kind} without a "${id}" text: ${preview(values)}`)
    if (kind === "localeString" && /[\r\n]/.test(value)) throw new Error(`localeString "${id}" spans several lines: ${preview(values)}`)
    out[id] = value
  }
  return out
}

/** A `localeString` value of the shared studio schema: one line, every language filled. */
export const localeString = (values: Localized) => ({ _type: "localeString" as const, ...checked("localeString", values) })

/** A `localeText` value of the shared studio schema: several lines allowed (blank line = new paragraph, `**bold**`), every language filled. */
export const localeText = (values: Localized) => ({ _type: "localeText" as const, ...checked("localeText", values) })
