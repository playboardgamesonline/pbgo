// The language of a visitor, as far as the platform speaks it: the twelve they can choose, how the languages of a browser find one of them, the key of the account that
// keeps their choice, the cookie that keeps it on a device, and what to write where when the account, the cookie and the browser disagree (docs/accounts.md). Pure and
// without any import beyond the list of languages, so that the browser, the server, the games' pages and the tests read it the same way.

import { DEFAULT_PLATFORM_LANGUAGE, PLATFORM_LANGUAGES } from "@pbgo/studio-kit/constants"

/**
 * A language a visitor can choose: any of the platform's twelve (`PLATFORM_LANGUAGES`). It is not the set of languages a site can render: the games have four
 * (`Locale` of `@pbgo/core/lib/i18n`, from `LANGUAGES`) until their Studios move to the same system, and a visitor whose language a site lacks reads English
 * there (`localeFor` of core). The four are among the twelve.
 */
export type PlatformLanguage = (typeof PLATFORM_LANGUAGES)[number]["id"]

/** The twelve languages a visitor can choose, English first, each with its name in that language: what a picker lists, in this order. */
export { PLATFORM_LANGUAGES }

/** English: the default of the platform and the fallback of every text. */
export const DEFAULT_LANGUAGE: PlatformLanguage = DEFAULT_PLATFORM_LANGUAGE

/**
 * The country whose flag stands for each language in the pickers (ISO 3166-1 alpha-2): the one the language is known by, since several languages are spoken in many countries and none of them is the language's alone. A flag is how a picker
 * finds a language at a glance, not a claim about it. A language added to the list without a country does not compile.
 */
export const PLATFORM_LANGUAGE_REGIONS = {
  en: "US",
  fr: "FR",
  es: "ES",
  de: "DE",
  zh: "CN",
  ja: "JP",
  ru: "RU",
  ar: "SA",
  bn: "BD",
  hi: "IN",
  pt: "PT",
  ko: "KR",
} as const satisfies Record<PlatformLanguage, string>

/** A country of those flags. */
export type LanguageRegion = (typeof PLATFORM_LANGUAGE_REGIONS)[PlatformLanguage]

/** The name of each language in that language, as a picker shows it. */
export const PLATFORM_LANGUAGE_NAMES = Object.fromEntries(PLATFORM_LANGUAGES.map((language) => [language.id, language.title])) as Record<PlatformLanguage, string>

const IDS: readonly string[] = PLATFORM_LANGUAGES.map((language) => language.id)

/** Whether a value is one of the platform's twelve languages (a cookie, a claim of the account or a form can hold anything). */
export function isPlatformLanguage(value: unknown): value is PlatformLanguage {
  return typeof value === "string" && IDS.includes(value)
}

/** The tags of an `Accept-Language` header, the most wanted first: `fr-CA,fr;q=0.9,en;q=0.8` is `fr-CA`, `fr`, `en`. A weight of 0 says "not this one" and `*` names no language: both are left out. */
function byPreference(header: string): string[] {
  return header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...parameters] = part.split(";")
      const weight = parameters.map((parameter) => /^\s*q\s*=\s*(\S+)\s*$/i.exec(parameter)?.[1]).find((value) => value !== undefined)
      return { tag: tag.trim(), q: weight === undefined ? 1 : Number(weight), index }
    })
    .filter(({ tag, q }) => tag !== "" && tag !== "*" && Number.isFinite(q) && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map(({ tag }) => tag)
}

/**
 * The language of the platform that a browser asks for: the first of its languages that the platform has, by the first part of the tag (`fr-CA` is French, `pt-BR`
 * Portuguese, `en-GB` English; every `zh-*`, Traditional included, is Chinese, Simplified, since there is no other Chinese yet), else English. It takes the header
 * `Accept-Language` (a string, with its `;q=` weights, which put the languages in order) or the list `navigator.languages` (already in order). No language at
 * all, as a crawler sends none, is English too: this is the platform's answer, not the games' (`fromAcceptLanguage` of core, which has four languages and
 * French as its default when the header is missing).
 */
export function matchPlatformLanguage(languages: string | readonly string[] | null | undefined): PlatformLanguage {
  const tags = typeof languages === "string" ? byPreference(languages) : (languages ?? [])
  for (const tag of tags) {
    const primary = tag.trim().toLowerCase().split(/[-_]/)[0]
    if (isPlatformLanguage(primary)) return primary
  }
  return DEFAULT_LANGUAGE
}

/**
 * The key of `user_metadata`, the free object of the account in Supabase Auth, that keeps the visitor's language. It is namespaced because a provider fills keys of
 * its own in the same object at each of its sign-ins (`name`, `picture`, `full_name`, `custom_claims`, and `locale` for some of them): `locale` is theirs,
 * `pbgo_locale` is ours. Nobody outside this module reads or writes it (`languageOf`, `saveLanguage` of `./client`), so that it can move to a `profiles.locale`
 * column the day the profiles exist (PLT-13).
 */
export const LANGUAGE_KEY = "pbgo_locale"

/** The language an account keeps, or null when it keeps none yet, or something that is not one of the twelve (a value written by hand, or by another version of the site). */
export function languageOf(user: { user_metadata?: Record<string, unknown> | null }): PlatformLanguage | null {
  const value = user.user_metadata?.[LANGUAGE_KEY]
  return isPlatformLanguage(value) ? value : null
}

/** The cookie that remembers the language on a device. The server reads it (`getLocale` of core), so every page is rendered in the visitor's language at the same address. */
export const LANGUAGE_COOKIE = "pbgo-locale"

/** How long the cookie lasts: a year, in seconds. */
export const LANGUAGE_COOKIE_MAX_AGE = 31536000

/** The options of the cookie when the server writes it (a route handler: `response.cookies.set`); `languageCookie` is the same cookie for the browser. */
export const LANGUAGE_COOKIE_OPTIONS = { path: "/", maxAge: LANGUAGE_COOKIE_MAX_AGE, sameSite: "lax" } as const

/** The cookie as `document.cookie` takes it. */
export function languageCookie(language: PlatformLanguage): string {
  return `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`
}

/** The language that a `document.cookie` string holds, or null when it holds none (or something that is not a language of the platform). */
export function languageFromCookies(cookies: string): PlatformLanguage | null {
  for (const part of cookies.split(";")) {
    const index = part.indexOf("=")
    if (index === -1 || part.slice(0, index).trim() !== LANGUAGE_COOKIE) continue
    const value = part.slice(index + 1).trim()
    return isPlatformLanguage(value) ? value : null
  }
  return null
}

/**
 * Whether a `document.cookie` string holds the session of a signed-in visitor: Supabase Auth's cookie is `sb-<project>-auth-token`, cut into `.0`, `.1`… when it is
 * long. The games' pages use it to leave the Supabase client alone for a guest, who is nearly everyone there; it is only a reason to ask the client, which is the one
 * that knows (the cookie of a one-time code, `…-auth-token-code-verifier`, is not a session).
 */
export function hasSessionCookie(cookies: string): boolean {
  return /(?:^|;\s*)sb-[^=;\s]+-auth-token(?:\.\d+)?=/.test(cookies)
}

/** What is known of the visitor's language, each source optional. */
export type LanguageSources = {
  /** The language their account keeps (`languageOf`): absent for a guest, for the demo account, and for an account that keeps none yet. */
  account?: PlatformLanguage | null
  /** The value of the cookie, as it was read: anything can be in it, and only a language of the platform counts. */
  cookie?: unknown
  /** The languages of the browser: `navigator.languages` or the header `Accept-Language`. */
  browser?: string | readonly string[] | null
}

/** The visitor's language, from what is known of it, in this order: the account's, else the cookie's, else the browser's, else English. */
export function resolveLanguage({ account, cookie, browser }: LanguageSources): PlatformLanguage {
  if (account) return account
  if (isPlatformLanguage(cookie)) return cookie
  return matchPlatformLanguage(browser)
}

/** What a signed-in visitor's device and account have to be told so that they agree (`planLanguage`). */
export type LanguagePlan = {
  /** The language to use. */
  language: PlatformLanguage
  /** The cookie does not hold it: write it. */
  writeCookie: boolean
  /** The account keeps no language yet, which is its first sign-in: it takes the one in use. After that the account is never written by a sync, only by a choice. */
  writeAccount: boolean
  /** The pages already drawn are in another language than the one now in use: they have to be rendered again. */
  refresh: boolean
}

/**
 * What to do for a signed-in visitor, from what the account, the cookie and the browser say. The account wins: its language is the one to use, and the cookie, which the
 * server reads, is rewritten to match. An account that keeps none takes the language in use (the cookie's, else the browser's, else English), once. `refresh` tells whether the
 * pages already drawn were in another language than the new one: before the account was known the page was in the language of the cookie, else of the browser.
 */
export function planLanguage(sources: LanguageSources): LanguagePlan {
  const language = resolveLanguage(sources)
  return {
    language,
    writeCookie: sources.cookie !== language,
    writeAccount: !sources.account,
    refresh: resolveLanguage({ cookie: sources.cookie, browser: sources.browser }) !== language,
  }
}
