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

/**
 * The state of a table that is over (the hidden information of the game: hands, decks) goes this many hours after the table was last written, once the game it played is written down (`game_results`). The end screen and the
 * rematch need it for a while, nothing needs it after a day. The owner's rule of 11 October 2026 (PLT-13): the state is deleted once the result is recorded.
 */
export const FINISHED_STATE_RETENTION_HOURS = 24

/**
 * The seats of a game that was not ranked (`game_participants`: who sat where, with the name and the picture the table showed, the place and the score) go this many calendar months after the game ended. The totals of the players
 * (`player_stats`) have counted the game by then, and the game itself (`game_results`) holds no one, so it stays. The seats of a ranked game stay as long as the account does. The owner's rule of 11 October 2026 (PLT-13): the unranked
 * results older than a year are folded into the totals of the players. The results themselves, and the ratings, are not cleaned up here: a result is kept, and a rating goes with its account.
 */
export const UNRANKED_SEAT_RETENTION_MONTHS = 12

/**
 * A member who deletes their account (PLT-36) has it CLOSED at once: nobody can sign in to it, and the e-mail they are sent holds a link that reopens it for this many days at least (to the end of the UTC day that is this many days away). Then the
 * link is dead, and the nightly clean-up deletes the account with what it holds (`erase_account`, migration 0011). The day is fixed when the account is closed (`account_deletions.scheduled_for`), so a later change of this number moves no promise
 * already made. The row of the settings, the e-mail, the Privacy Policy and the Terms print it.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 7

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** A table whose `updated_at` is strictly before this instant is old enough to delete. */
export function tableCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - TABLE_RETENTION_DAYS * DAY_MS)
}

/** A member whose `seen_at` is strictly before this instant has not been seen for longer than `PRESENCE_RETENTION_DAYS`: their row is old enough to delete. */
export function presenceCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - PRESENCE_RETENTION_DAYS * DAY_MS)
}

/** The same moment `months` calendar months earlier, in UTC. A day that the earlier month does not have lands on that month's last day (29 February 2028 → 28 February 2027). */
function monthsBefore(now: Date, months: number): Date {
  const cutoff = new Date(now)
  const day = cutoff.getUTCDate()
  cutoff.setUTCDate(1)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate()
  cutoff.setUTCDate(Math.min(day, lastDay))
  return cutoff
}

/** A feedback whose `created_at` is strictly before this instant is old enough to delete: the same moment `FEEDBACK_RETENTION_MONTHS` calendar months earlier, in UTC. */
export function feedbackCutoff(now: Date = new Date()): Date {
  return monthsBefore(now, FEEDBACK_RETENTION_MONTHS)
}

/** The state of a table that is over and was last written strictly before this instant is old enough to delete, if its game is written down. */
export function finishedStateCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - FINISHED_STATE_RETENTION_HOURS * HOUR_MS)
}

/** The seats of an unranked game that ended strictly before this instant are old enough to delete: the same moment `UNRANKED_SEAT_RETENTION_MONTHS` calendar months earlier, in UTC. */
export function unrankedSeatCutoff(now: Date = new Date()): Date {
  return monthsBefore(now, UNRANKED_SEAT_RETENTION_MONTHS)
}

/**
 * The moment the link that reopens an account stops working, and the account is due to be deleted, when its member closed it at `now`: the last millisecond of the UTC day that is `ACCOUNT_DELETION_GRACE_DAYS` days away. The e-mail says that day
 * ("until 16 November"), so the link works through the whole of it, and the nightly clean-up deletes the account in the night after.
 */
export function accountDeletionDate(now: Date = new Date()): Date {
  const day = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS)
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1) - 1)
}
