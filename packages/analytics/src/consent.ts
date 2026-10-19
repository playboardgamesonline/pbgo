/**
 * The visitor's answer to the cookie banner, and how long it holds. Pure: the storage is handed in, so tests (and a browser
 * that refuses `localStorage`) never reach for a global.
 */

export type Choice = "accepted" | "refused"

export type Consent = {
  choice: Choice
  /** ISO date of the answer: what the choice is dated from, and when it is asked again. */
  at: string
}

export const CONSENT_KEY = "pbgo-consent"

/** The answer is asked again after this many months (the CNIL's ceiling for the life of a tracker). */
export const CONSENT_RENEWAL_MONTHS = 13

/** The subset of `Storage` we use, so a test can pass a plain object. */
export type ConsentStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const DAY_MS = 86_400_000

/** Calendar months, in UTC (a local DST change never moves the day). */
export function addMonths(from: Date, months: number): Date {
  const date = new Date(from.getTime())
  date.setUTCMonth(date.getUTCMonth() + months)
  return date
}

export function makeConsent(choice: Choice, now: Date = new Date()): Consent {
  return { choice, at: now.toISOString() }
}

/**
 * What was stored, if it still counts: null when missing, malformed, dated in the future (a clock that was wrong when the
 * visitor answered) or older than the renewal delay.
 */
export function parseConsent(raw: string | null, now: Date = new Date()): Consent | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== "object" || value === null) return null
  const { choice, at } = value as Record<string, unknown>
  if (choice !== "accepted" && choice !== "refused") return null
  if (typeof at !== "string") return null
  const given = new Date(at)
  if (Number.isNaN(given.getTime())) return null
  if (given.getTime() > now.getTime() + DAY_MS) return null
  if (addMonths(given, CONSENT_RENEWAL_MONTHS).getTime() <= now.getTime()) return null
  return { choice, at: given.toISOString() }
}

/** A storage that throws (private window, blocked site data) is the same as an empty one. */
export function readConsent(store: ConsentStore, now: Date = new Date()): Consent | null {
  try {
    return parseConsent(store.getItem(CONSENT_KEY), now)
  } catch {
    return null
  }
}

/** The answer is returned even when it could not be kept: the page view still follows it. */
export function writeConsent(store: ConsentStore, choice: Choice, now: Date = new Date()): Consent {
  const consent = makeConsent(choice, now)
  try {
    store.setItem(CONSENT_KEY, JSON.stringify(consent))
  } catch {
    // Kept in memory by the caller for this page view; the question comes back on the next one.
  }
  return consent
}

export function clearConsent(store: ConsentStore): void {
  try {
    store.removeItem(CONSENT_KEY)
  } catch {
    // Nothing to clear.
  }
}
