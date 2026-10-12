import type { Locale } from "./i18n"

/**
 * Date and time of a game in the visitor's language, e.g. "5 octobre 2026 · 14:05" (fr) or "5. Oktober 2026 · 14:05" (de).
 * The language code is enough for `Intl`. `timeZone` is the visitor's own unless given (tests pin it).
 */
export function formatDateTime(date: Date, locale: Locale, timeZone?: string) {
  const day = date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone })
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone })
  return `${day} · ${time}`
}
