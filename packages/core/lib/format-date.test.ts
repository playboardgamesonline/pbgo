import { describe, expect, it } from "vitest"
import { formatDateTime } from "./format-date"
import type { Locale } from "./i18n"

const PARIS = "Europe/Paris"
// 14:05 and 08:09 in Paris: a two-digit hour, a single-digit day, a month with an accent in some languages
const AFTERNOON = new Date("2026-10-05T12:05:00Z")
const MORNING = new Date("2026-03-07T07:09:00Z")

// some ICU versions put a (narrow) no-break space before AM / PM
const plain = (text: string) => text.replace(/[  ]/g, " ")

/** What the scoreboard footer and the shared image wrote before the visitor's language was used: always fr-FR. */
function frFR(date: Date, timeZone?: string) {
  const day = date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone })
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone })
  return `${day} · ${time}`
}

describe("formatDateTime", () => {
  it.each<[Locale, string, string]>([
    ["fr", "5 octobre 2026 · 14:05", "7 mars 2026 · 08:09"],
    ["en", "October 5, 2026 · 02:05 PM", "March 7, 2026 · 08:09 AM"],
    ["es", "5 de octubre de 2026 · 14:05", "7 de marzo de 2026 · 08:09"],
    ["de", "5. Oktober 2026 · 14:05", "7. März 2026 · 08:09"],
  ])("writes the date and the time in the visitor's language (%s)", (locale, afternoon, morning) => {
    expect(plain(formatDateTime(AFTERNOON, locale, PARIS))).toBe(afternoon)
    expect(plain(formatDateTime(MORNING, locale, PARIS))).toBe(morning)
  })

  it("keeps the French output exactly as it was with fr-FR", () => {
    const evening = new Date("2026-12-31T22:30:00Z")
    for (const date of [AFTERNOON, MORNING, evening]) {
      expect(formatDateTime(date, "fr", PARIS)).toBe(frFR(date, PARIS))
      // without a time zone, as the footer and the image call it: the visitor's own
      expect(formatDateTime(date, "fr")).toBe(frFR(date))
    }
  })

  it("follows the time zone it is given", () => {
    const evening = new Date("2026-12-31T22:30:00Z")
    expect(formatDateTime(evening, "fr", PARIS)).toBe("31 décembre 2026 · 23:30")
    expect(formatDateTime(evening, "fr", "Asia/Tokyo")).toBe("1 janvier 2027 · 07:30")
    expect(formatDateTime(evening, "fr", "America/Los_Angeles")).toBe("31 décembre 2026 · 14:30")
  })
})
