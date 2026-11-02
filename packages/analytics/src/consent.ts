/**
 * The visitor's answer to the cookie banner, and how long it holds. Pure: the storage is handed in, so tests (and a browser
 * that refuses `localStorage`) never reach for a global.
 */

/**
 * What the SDK follows: analytics (the identifier and the recordings) allowed or not. As a shorthand for a whole answer, `accepted` is
 * Accept all and `refused` is Reject optional: every switch the same way.
 */
export type Choice = "accepted" | "refused"

/** The switches of the banner's choices: what the visitor lets the site do beyond what it needs to work. */
export type Answer = {
  analytics: boolean
  /** The site has no marketing cookie yet, so no tool follows this one: the answer is kept for the day one does. */
  marketing: boolean
}

export const ACCEPT_ALL: Answer = { analytics: true, marketing: true }
export const REJECT_OPTIONAL: Answer = { analytics: false, marketing: false }

export type Consent = {
  /** Analytics: the only switch a tool follows today. */
  choice: Choice
  /** Marketing: kept, followed by nothing yet. */
  marketing: boolean
  /** ISO date of the answer: what the choice is dated from, and when it is asked again. */
  at: string
}

export const CONSENT_KEY = "pbgo-consent"

/** The answer is asked again after this many months (the CNIL's ceiling for the life of a tracker). */
export const CONSENT_RENEWAL_MONTHS = 13

/**
 * What a stored answer covers. Raise it the day a tool needs a purpose that the answers given so far never offered (the first marketing
 * tool): every answer stored under a lower revision is then asked again, so no one is held to a yes given for something that did not exist.
 */
export const CONSENT_REVISION = 1

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

/** A `Choice` as a whole answer: every switch the same way. */
export function answerFrom(choice: Choice): Answer {
  return choice === "accepted" ? ACCEPT_ALL : REJECT_OPTIONAL
}

/** The switches as a stored answer leaves them; none stored: all off. */
export function answerOf(consent: Consent | null): Answer {
  return { analytics: consent?.choice === "accepted", marketing: consent?.marketing === true }
}

export function makeConsent(answer: Answer | Choice, now: Date = new Date()): Consent {
  const { analytics, marketing } = typeof answer === "string" ? answerFrom(answer) : answer
  return { choice: analytics ? "accepted" : "refused", marketing, at: now.toISOString() }
}

/**
 * What was stored, if it still counts: null when missing, malformed, dated in the future (a clock that was wrong when the
 * visitor answered), older than the renewal delay, or given under an older revision than `revision`. An answer stored before
 * marketing existed has no `marketing` (off) and no revision (the first).
 */
export function parseConsent(raw: string | null, now: Date = new Date(), revision: number = CONSENT_REVISION): Consent | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== "object" || value === null) return null
  const { choice, marketing, rev, at } = value as Record<string, unknown>
  if (choice !== "accepted" && choice !== "refused") return null
  if (typeof at !== "string") return null
  if ((typeof rev === "number" ? rev : 1) < revision) return null
  const given = new Date(at)
  if (Number.isNaN(given.getTime())) return null
  if (given.getTime() > now.getTime() + DAY_MS) return null
  if (addMonths(given, CONSENT_RENEWAL_MONTHS).getTime() <= now.getTime()) return null
  return { choice, marketing: marketing === true, at: given.toISOString() }
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
export function writeConsent(store: ConsentStore, answer: Answer | Choice, now: Date = new Date()): Consent {
  const consent = makeConsent(answer, now)
  try {
    store.setItem(CONSENT_KEY, JSON.stringify({ ...consent, rev: CONSENT_REVISION }))
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
