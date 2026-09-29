export const LOCALES = ["fr", "en"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "fr"

export type Localized<T = string> = Partial<Record<Locale, T | null>> | null | undefined

export function translate<T>(value: Localized<T>, locale: Locale = DEFAULT_LOCALE): T | undefined {
  if (!value) return undefined
  return value[locale] ?? value[DEFAULT_LOCALE] ?? LOCALES.map((l) => value[l]).find((v) => v != null) ?? undefined
}
