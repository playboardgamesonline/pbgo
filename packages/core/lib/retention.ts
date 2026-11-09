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
 * An account whose member asked for its deletion and confirmed it by the link of the e-mail (PLT-36) is kept this many days, ON HOLD: signed out everywhere, treated as a visitor by everything that asks who is signed in (it sits at no new table
 * and is not counted online), and its member may keep it by signing in again. Then the nightly clean-up deletes it with what it holds (`erase_account`, migration 0011). The day is fixed when the member confirms (`account_deletions.scheduled_for`), so a later change
 * of this number moves no promise already made. The Privacy Policy prints it.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30

/** The link of the e-mail that confirms the deletion works for this many minutes, and once. The e-mail and the Privacy Policy say it. */
export const ACCOUNT_DELETION_LINK_MINUTES = 60

/** The trace of a link nobody confirmed (a row of `account_deletions`, holding the hash of the token and when it stops working) goes this many days after the link stopped working. */
export const ACCOUNT_DELETION_LINK_RETENTION_DAYS = 1

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

/** The day an account is deleted when its member confirms the link at `now`: `ACCOUNT_DELETION_GRACE_DAYS` days later. */
export function accountDeletionDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS)
}

/** The moment a link asked for at `now` stops working. */
export function deletionLinkExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + ACCOUNT_DELETION_LINK_MINUTES * 60 * 1000)
}

/** A link whose token stopped working strictly before this instant has been dead for `ACCOUNT_DELETION_LINK_RETENTION_DAYS` days: its row is old enough to delete. */
export function deletionLinkCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - ACCOUNT_DELETION_LINK_RETENTION_DAYS * DAY_MS)
}
