import { LANGUAGES } from "@pbgo/studio-kit/constants"

/** Langues du site : à étendre dans `LANGUAGES` (studio-kit), qui alimente aussi les champs Sanity. */
export const LOCALES = LANGUAGES.map((l) => l.id) as unknown as readonly ("fr" | "en" | "es" | "de")[]
export type Locale = (typeof LANGUAGES)[number]["id"]

export const DEFAULT_LOCALE = "fr" as const satisfies Locale

/** Nom de chaque langue dans sa propre langue, et code court affiché dans le sélecteur. */
export const LOCALE_NAMES: Record<Locale, string> = Object.fromEntries(LANGUAGES.map((l) => [l.id, l.title])) as Record<Locale, string>

export const LOCALE_COOKIE = "pbgo-locale"

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v)

/** Première langue gérée de l'en-tête Accept-Language (`fr-CA,fr;q=0.9,en;q=0.8` → `fr`), sinon la langue par défaut. */
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

/** Valeur dans la langue demandée, sinon en français, sinon dans la première langue renseignée. */
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
 * Valeur dans la langue demandée uniquement (pas de repli sur le français) pour les autres langues : c'est ce qui laisse jouer
 * les traductions par défaut du code tant que rien n'est saisi dans Sanity. En français, même règle que `translate`.
 */
export function only<T>(value: Localized<T>, locale: Locale): T | undefined {
  if (locale === DEFAULT_LOCALE) return translate(value, locale)
  const v = value?.[locale]
  return v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0) ? undefined : v
}

/** Code OpenGraph (`og:locale`) de chaque langue */
export const OG_LOCALES: Record<Locale, string> = { fr: "fr_FR", en: "en_US", es: "es_ES", de: "de_DE" }
