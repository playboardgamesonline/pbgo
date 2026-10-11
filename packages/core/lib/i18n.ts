import { LANGUAGES } from "@pbgo/studio-kit/constants"

/** Languages of the site: extend `LANGUAGES` (studio-kit), which also feeds the Sanity fields. */
export const LOCALES = LANGUAGES.map((l) => l.id) as unknown as readonly ("fr" | "en" | "es" | "de")[]
export type Locale = (typeof LANGUAGES)[number]["id"]

export const DEFAULT_LOCALE = "fr" as const satisfies Locale

/** Name of each language in that language, shown by the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = Object.fromEntries(LANGUAGES.map((l) => [l.id, l.title])) as Record<Locale, string>

export const LOCALE_COOKIE = "pbgo-locale"

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v)

/** First supported language of the Accept-Language header (`fr-CA,fr;q=0.9,en;q=0.8` → `fr`), else English (unsupported language) or the default language (no header). */
export function fromAcceptLanguage(header: string | null | undefined): Locale {
  const wanted = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=")
      return { lang: (tag ?? "").toLowerCase().split("-")[0]!, q: q ? Number(q) : 1 }
    })
    .filter((x) => x.lang && Number.isFinite(x.q))
    .sort((a, b) => b.q - a.q)
  // browser in an unsupported language: English; no header (crawlers): French
  return wanted.map((x) => x.lang).find(isLocale) ?? (wanted.length ? "en" : DEFAULT_LOCALE)
}

export type Localized<T = string> = Partial<Record<Locale, T | null>> | null | undefined

/** Value in the requested language, else in French, else in the first language filled in. */
export function translate<T>(value: Localized<T>, locale: Locale = DEFAULT_LOCALE): T | undefined {
  if (!value) return undefined
  const has = (v: T | null | undefined) => v != null && (typeof v !== "string" || v.trim() !== "") && !(Array.isArray(v) && v.length === 0)
  const own = value[locale]
  if (has(own)) return own as T
  const fr = value[DEFAULT_LOCALE]
  if (has(fr)) return fr as T
  return LOCALES.map((l) => value[l]).find(has) ?? undefined
}

/**
 * Value in the requested language only (no French fallback) for the other languages: this lets the code's default
 * translations apply as long as nothing is entered in Sanity. In French, same rule as `translate`.
 */
export function only<T>(value: Localized<T>, locale: Locale): T | undefined {
  if (locale === DEFAULT_LOCALE) return translate(value, locale)
  const v = value?.[locale]
  return v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0) ? undefined : v
}

/** OpenGraph code (`og:locale`) of each language */
export const OG_LOCALES: Record<Locale, string> = { fr: "fr_FR", en: "en_US", es: "es_ES", de: "de_DE" }
