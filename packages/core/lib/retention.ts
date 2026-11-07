/**
 * How long the database keeps what it holds about people (PLT-113). The one place the periods are written: the nightly clean-up
 * (`server/retention.ts`) reads them, and so does the Privacy Policy page, so that what a visitor reads and what the job does cannot
 * drift apart. Pure and without any import, so that the page and the server both take it.
 */

/** A table (`games`) goes this many days after it was last written: a move, a join, a change of options. Presence does not count (`touch_game_player` leaves `updated_at` alone). */
export const TABLE_RETENTION_DAYS = 30

/** A feedback (`feedback`) goes this many calendar months after it was received, with its screenshot. */
export const FEEDBACK_RETENTION_MONTHS = 12

/** The last time a signed-in member was seen on the site (`member_presence`) goes this many days after the last beat. It counts the players online for two minutes, so a day is more than it needs. */
export const PRESENCE_RETENTION_DAYS = 1

const DAY_MS = 24 * 60 * 60 * 1000

/** A table whose `updated_at` is strictly before this instant is old enough to delete. */
export function tableCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - TABLE_RETENTION_DAYS * DAY_MS)
}

/** A member whose `seen_at` is strictly before this instant has not been seen for longer than `PRESENCE_RETENTION_DAYS`: their row is old enough to delete. */
export function presenceCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - PRESENCE_RETENTION_DAYS * DAY_MS)
}

/**
 * A feedback whose `created_at` is strictly before this instant is old enough to delete: the same moment `FEEDBACK_RETENTION_MONTHS` calendar months earlier, in UTC.
 * A day that the earlier month does not have lands on that month's last day (29 February 2028 → 28 February 2027).
 */
export function feedbackCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now)
  const day = cutoff.getUTCDate()
  cutoff.setUTCDate(1)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - FEEDBACK_RETENTION_MONTHS)
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate()
  cutoff.setUTCDate(Math.min(day, lastDay))
  return cutoff
}
