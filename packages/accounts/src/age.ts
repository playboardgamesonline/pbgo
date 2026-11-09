// The age of a member against the age that a game or an expansion asks (PLT-125). Pure, with no import, so that the server (which decides), the pages (which say what is needed) and the tests all read it the same way.
//
// A date of birth is DECLARED by the member: nothing here, nor anywhere in the site, proves it. What the check does is keep the declaration where the member cannot rewrite it (a table only the server writes, locked once saved: `docs/accounts.md`,
// "The age check") and judge it on the server, in whole years counted on the UTC calendar. Never trust a browser's clock or a browser's word for any of it.

/** The youngest a member can be: the Terms of Use say 13 (`/legal/terms`, "Who can use the site"). A date that makes the member younger is refused and not kept. */
export const SITE_MINIMUM_AGE = 13

/** The oldest a date of birth can be: further back is a mistake in the year. */
export const OLDEST_AGE = 120

/**
 * From which minimum age the platform enforces what a game, or an expansion, asks. Below it the age is advice that the page shows ("Ages 8+"): the site's own minimum is 13, and the age on a box is mostly a guess at what a child understands, so a game
 * for 14 must not close its door to a member of 13 or to every guest. From here up, the number of the game is the age a member must have (16 asks for 16, 18 for 18).
 */
export const RESTRICTED_FROM = 16

/** The age that a minimum age asks of the people at a table, when the platform enforces it (`RESTRICTED_FROM`): the minimum age itself, rounded up to a whole year; null when it asks nothing, or nothing is said. */
export function restrictedAge(minAge: number | null | undefined): number | null {
  return typeof minAge === "number" && Number.isFinite(minAge) && minAge >= RESTRICTED_FROM ? Math.ceil(minAge) : null
}

/** A day of the calendar: the year, the month from 1 to 12 and the day from 1. */
type Day = { year: number; month: number; day: number }

/** The day of a date of birth as it is kept (`YYYY-MM-DD`, a day that exists), or null for anything else: a month 13, a 30 February, a date with a time, a number. */
function dayOf(value: unknown): Day | null {
  if (typeof value !== "string") return null
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!parts) return null
  const day: Day = { year: Number(parts[1]), month: Number(parts[2]), day: Number(parts[3]) }
  const date = new Date(0)
  // setUTCFullYear and not Date.UTC: a year below 100 is a year of the 1900s for Date.UTC
  date.setUTCFullYear(day.year, day.month - 1, day.day)
  return date.getUTCFullYear() === day.year && date.getUTCMonth() === day.month - 1 && date.getUTCDate() === day.day ? day : null
}

/** The calendar day an instant falls on in UTC. */
const utcDay = (now: Date): Day => ({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() })

/**
 * The whole years between a date of birth and the day `now` falls on in UTC, or null when the value is not a date of birth (`YYYY-MM-DD`, a day that exists). A birthday counts on its day, and not before; a 29 February counts on the 1st of March in a
 * year that has no 29 February. A date in the future gives a negative age: the caller decides what it is (`birthdateProblem`).
 */
export function ageInYears(birthdate: unknown, now: Date): number | null {
  const birth = dayOf(birthdate)
  if (!birth) return null
  const today = utcDay(now)
  const birthdayPassed = today.month > birth.month || (today.month === birth.month && today.day >= birth.day)
  return today.year - birth.year - (birthdayPassed ? 0 : 1)
}

/** What is wrong with a date of birth that a member declares: it is not a date of birth, or it makes them younger than the site allows. */
export type BirthdateProblem = "invalid" | "under-minimum"

/** A date of birth judged: it has to be a day that exists, not in the future, not more than `OLDEST_AGE` years ago and not make the member younger than `SITE_MINIMUM_AGE`. Null when it can be kept. */
export function birthdateProblem(value: unknown, now: Date): BirthdateProblem | null {
  const age = ageInYears(value, now)
  if (age === null || age < 0 || age > OLDEST_AGE) return "invalid"
  return age < SITE_MINIMUM_AGE ? "under-minimum" : null
}

/** Who asks to sit at a table, as far as the age is concerned: a guest, who has no account and so no date; or a member, with the date they declared, if they declared one. */
export type AgeSubject = { kind: "guest" } | { kind: "member"; birthdate: string | null }

/** Why somebody may not sit at a table that asks for an age: they have no account (sign in), no date of birth (add it) or are too young. */
export type AgeRefusal = "sign-in" | "date" | "too-young"

/** Whether `subject` may sit at a table that asks `required` years (null: it asks none, so everybody may): null when they may, else why not. A date that is not a date of birth counts as no date. */
export function ageRefusal(required: number | null, subject: AgeSubject, now: Date): AgeRefusal | null {
  if (required === null) return null
  if (subject.kind === "guest") return "sign-in"
  const age = ageInYears(subject.birthdate, now)
  if (age === null) return "date"
  return age < required ? "too-young" : null
}
