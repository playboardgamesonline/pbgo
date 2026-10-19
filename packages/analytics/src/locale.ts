import { LANGUAGES } from "@pbgo/studio-kit/constants"
import type { Locale } from "./events"

/**
 * The language of the banner. The hub is static and every page reads the visitor's language on the server, but the banner is
 * a client island: it resolves its own, the way the site does (cookie, then browser, English when unsupported), without
 * importing `@pbgo/core`, which depends on this package.
 */

/** Same cookie as `LOCALE_COOKIE` of `@pbgo/core/lib/i18n` (a test in core keeps them equal). */
export const LOCALE_COOKIE = "pbgo-locale"

const LOCALES: readonly string[] = LANGUAGES.map((language) => language.id)

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
 * The visitor's cookie wins, then the first language of the browser that the site speaks (`fr-CA` is French). No language at all:
 * French, the site's default; none of them supported: English. Same rules as `fromAcceptLanguage` of core.
 */
export function pickLocale(input: { cookie?: string; languages?: readonly string[] }): Locale {
  if (isLocale(input.cookie)) return input.cookie
  const languages = input.languages ?? []
  if (languages.length === 0) return "fr"
  for (const language of languages) {
    const primary = language.toLowerCase().split("-")[0]
    if (isLocale(primary)) return primary
  }
  return "en"
}
