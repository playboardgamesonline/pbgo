// What the finished games of a visitor say, for their figures and their history on a game's page: how a game ended for them, the share of games they won, a change of rating as it is written, and the time they played. No React in this file, so that it
// is tested as it is. The hub's page works these out from its rows (`apps/web/src/lib/game-activity-props.ts`) and the blocks draw what they are given.

/** How a game ended for a player, as the platform records it (`game_participants.outcome`). */
export type Outcome = "win" | "loss" | "draw" | "coop_win" | "coop_loss" | "abandoned"

/** The same in the four words of a row of the history: a game is won (alone or all together), lost or drawn, and one that was left before its end is abandoned. */
export type Result = "won" | "lost" | "draw" | "abandoned"

/** How a game ended for a player, in the word of a row of the history. */
export function resultOf(outcome: Outcome): Result {
  switch (outcome) {
    case "win":
    case "coop_win":
      return "won"
    case "loss":
    case "coop_loss":
      return "lost"
    case "draw":
      return "draw"
    case "abandoned":
      return "abandoned"
  }
}

/** The share of games won, in whole percent: null when no game was played, since there is nothing to share. */
export function winRate(wins: number, played: number): number | null {
  return played > 0 ? Math.round((wins / played) * 100) : null
}

/** A change of rating with its sign, as a whole number: "+14", "−9" (a true minus sign, which the typeface draws as wide as the plus) and "0" when it did not move. */
export function signed(change: number): string {
  const rounded = Math.round(change)
  return rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${Math.abs(rounded)}` : "0"
}

/** What a player has won, in words: "14 wins in 24 games", "1 win in 1 game". */
export function recordOf(wins: number, played: number): string {
  return `${wins} ${wins === 1 ? "win" : "wins"} in ${played} ${played === 1 ? "game" : "games"}`
}

/**
 * How long ago something happened, in the one unit that fits: "Just now", "4 min ago", "3 h ago", "2 d ago", "3 w ago", "5 mo ago", "2 y ago". `since` is an ISO date, `now` is a parameter so that it is tested; a date that does not read, or one in the
 * future, counts as now.
 */
export function agoOf(since: string, now: number = Date.now()): string {
  const minutes = Math.floor((Math.max(0, now - Date.parse(since)) || 0) / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d ago`
  if (days < 60) return `${Math.floor(days / 7)} w ago`
  if (days < 365) return `${Math.floor(days / 30)} mo ago`
  return `${Math.floor(days / 365)} y ago`
}

/**
 * A total of time played, in the unit that suits a whole history: "0 h" for none, "42 min" under an hour, "9.5 h" under ten hours and whole hours after, "38 h". Unlike `lasted` of `./tables`, which says how old a table is, it never counts
 * in days: a visitor's total is read in hours. What is not a time (a negative number, not a number) is none.
 */
export function timePlayed(seconds: number): string {
  const minutes = Math.floor((Math.max(0, seconds) || 0) / 60)
  if (minutes === 0) return "0 h"
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return hours < 10 ? `${Math.floor(hours * 10) / 10} h` : `${Math.floor(hours)} h`
}
