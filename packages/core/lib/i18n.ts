import { LANGUAGE_COOKIE, type PlatformLanguage } from "@pbgo/accounts/language"
import { LANGUAGES } from "@pbgo/studio-kit/constants"

/**
 * Languages a game's site can render: extend `LANGUAGES` (studio-kit), which also feeds the Sanity fields. Not the languages a visitor can choose: those are the platform's twelve
 * (`PlatformLanguage`, `PLATFORM_LANGUAGES`), kept on their account and in the cookie, and a visitor whose language a site lacks reads English there (`localeFor`).
 */
export const LOCALES = LANGUAGES.map((l) => l.id) as unknown as readonly ("fr" | "en" | "es" | "de")[]
export type Locale = (typeof LANGUAGES)[number]["id"]

// Every language a site renders is one a visitor can choose: this stops compiling the day `LANGUAGES` gets a language that `PLATFORM_LANGUAGES` lacks
type Assert<T extends true> = T
export type SitesRenderOnlyChoosableLanguages = Assert<Locale extends PlatformLanguage ? true : false>

export const DEFAULT_LOCALE = "fr" as const satisfies Locale

/** What a site renders for a visitor whose language it does not have. */
export const FALLBACK_LOCALE = "en" as const satisfies Locale

/** Name of each language in that language, shown by the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = Object.fromEntries(LANGUAGES.map((l) => [l.id, l.title])) as Record<Locale, string>

/** The cookie of the visitor's language (`@pbgo/accounts`): it holds any of the platform's twelve languages, the games read the four they have. */
export const LOCALE_COOKIE = LANGUAGE_COOKIE

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v)

/**
 * The language a site renders for a visitor's language: their own when the site has it, else English. A visitor chooses among the platform's twelve languages and the games render
 * four, so one who chose Japanese (or whose account did) reads English there, not the language their browser comes second with.
 */
export const localeFor = (language: PlatformLanguage): Locale => (isLocale(language) ? language : FALLBACK_LOCALE)

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
 * Value in the requested language only (no French fallback) for the other languages: a gap in a language stays visible
 * (the platform's own wording for its chrome, `[missing: <key>]` for a text of the game) instead of reading another
 * language. In French, same rule as `translate`.
 */
export function only<T>(value: Localized<T>, locale: Locale): T | undefined {
  if (locale === DEFAULT_LOCALE) return translate(value, locale)
  const v = value?.[locale]
  return v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0) ? undefined : v
}

/** OpenGraph code (`og:locale`) of each language */
export const OG_LOCALES: Record<Locale, string> = { fr: "fr_FR", en: "en_US", es: "es_ES", de: "de_DE" }
