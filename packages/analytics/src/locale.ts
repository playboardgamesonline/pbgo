import { LANGUAGES, PLATFORM_LANGUAGES } from "@pbgo/studio-kit/constants"
import type { Locale } from "./events"

/**
 * How the banner would pick its language. The hub is static and every page reads the visitor's language on the server, but the banner is
 * a client island: it resolves its own, the way the site does (cookie, then browser, English otherwise), without
 * importing `@pbgo/core`, which depends on this package.
 *
 * Not used for now: the site is in English only (the owner, 2026-11-01) and `banner.tsx` speaks English to everyone. It stays, with its tests
 * and the one in core that keeps it equal to `fromAcceptLanguage`, for the language pass (PLT-32).
 */

/** Same cookie as `LOCALE_COOKIE` of `@pbgo/core/lib/i18n` (a test in core keeps them equal). */
export const LOCALE_COOKIE = "pbgo-locale"

const LOCALES: readonly string[] = LANGUAGES.map((language) => language.id)

/** The twelve languages a visitor can choose: the cookie holds any of them, the banner speaks four. */
const CHOOSABLE: readonly string[] = PLATFORM_LANGUAGES.map((language) => language.id)

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value)
}

/** The value of a cookie in a `document.cookie` string. */
export function cookieValue(cookies: string, name: string): string | undefined {
  for (const part of cookies.split(";")) {
    const index = part.indexOf("=")
    if (index === -1 || part.slice(0, index).trim() !== name) continue
    const raw = part.slice(index + 1).trim()
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return undefined
}

/**
 * The visitor's cookie wins, then the first language of the browser that the site speaks (`fr-CA` is French). No language at all, or none
 * of them supported: English, the site's default. Same rules as `fromAcceptLanguage` of core. A cookie that holds one of the
 * platform's twelve languages that the banner lacks (Japanese, say) is English, as it is in the games (`localeFor` of core), not the language the browser comes second with.
 */
export function pickLocale(input: { cookie?: string; languages?: readonly string[] }): Locale {
  if (isLocale(input.cookie)) return input.cookie
  if (input.cookie !== undefined && CHOOSABLE.includes(input.cookie)) return "en"
  for (const language of input.languages ?? []) {
    const primary = language.toLowerCase().split("-")[0]
    if (isLocale(primary)) return primary
  }
  return "en"
}
