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

/**
 * English: the default language, which a page is drawn in when nothing asks for another (a visitor with no cookie and a browser in a language the games lack, a request with no
 * `Accept-Language` at all), and the fallback of every text (`translate`). The other languages are options.
 */
export const DEFAULT_LOCALE = "en" as const satisfies Locale

/** Name of each language in that language, shown by the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = Object.fromEntries(LANGUAGES.map((l) => [l.id, l.title])) as Record<Locale, string>

/** The cookie of the visitor's language (`@pbgo/accounts`): it holds any of the platform's twelve languages, the games read the four they have. */
export const LOCALE_COOKIE = LANGUAGE_COOKIE

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v)

/**
 * The language a site renders for a visitor's language: their own when the site has it, else English. A visitor chooses among the platform's twelve languages and the games render
 * four, so one who chose Japanese (or whose account did) reads English there, not the language their browser comes second with.
 */
export const localeFor = (language: PlatformLanguage): Locale => (isLocale(language) ? language : DEFAULT_LOCALE)

/** First supported language of the Accept-Language header (`fr-CA,fr;q=0.9,en;q=0.8` → `fr`), else English: a browser in a language the games lack, or no header at all (a crawler). */
export function fromAcceptLanguage(header: string | null | undefined): Locale {
  const wanted = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=")
      return { lang: (tag ?? "").toLowerCase().split("-")[0]!, q: q ? Number(q) : 1 }
    })
    .filter((x) => x.lang && Number.isFinite(x.q))
    .sort((a, b) => b.q - a.q)
  return wanted.map((x) => x.lang).find(isLocale) ?? DEFAULT_LOCALE
}

export type Localized<T = string> = Partial<Record<Locale, T | null>> | null | undefined

/** Whether a value of a text is there: not null, not blank, not an empty list. */
const has = <T>(v: T | null | undefined): v is T => v != null && (typeof v !== "string" || v.trim() !== "") && !(Array.isArray(v) && v.length === 0)

/**
 * The value of a text for a visitor: in the language asked, else in English, else nothing. English is the default language and the fallback of every text; when it has no value
 * either, the caller shows `[missing: <key>]` for a text it requires (`lib/missing.ts`) and draws nothing for one it does not. No other language ever stands in: not French, which
 * was the default before English, and not "the first language that has a value".
 */
export function translate<T>(value: Localized<T>, locale: Locale = DEFAULT_LOCALE): T | undefined {
  if (!value) return undefined
  const own = value[locale]
  if (has(own)) return own
  const fallback = value[DEFAULT_LOCALE]
  return has(fallback) ? fallback : undefined
}

/**
 * The value written in exactly that language, with no fallback: what a game's owner typed to replace the platform's own wording (a label of the interface, the message of one of
 * the platform's errors). The platform has its wording in every language of the games, so a label typed in English must not take the place of the Spanish one.
 */
export function written<T>(value: Localized<T>, locale: Locale): T | undefined {
  const own = value?.[locale]
  return has(own) ? own : undefined
}

/** @deprecated The same as `translate` since English became the default language and the fallback: a gap in a language reads English, then `[missing: <key>]`. Kept for the branches that still import it. */
export const only = translate

/** OpenGraph code (`og:locale`) of each language */
export const OG_LOCALES: Record<Locale, string> = { fr: "fr_FR", en: "en_US", es: "es_ES", de: "de_DE" }
