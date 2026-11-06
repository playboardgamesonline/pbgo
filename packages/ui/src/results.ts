// What the finished games of a visitor say, for their figures and their history on a game's page: how a game ended for them, the share of games they won, how a record is written, and the time they played. No React in this file, so that it
// is tested as it is. The hub's page works these out from its rows (`apps/web/src/lib/game-activity-props.ts`) and the blocks draw what they are given.

/** How a game ended for a player, as the platform records it (`game_participants.outcome`). */
export type Outcome = "win" | "loss" | "draw" | "coop_win" | "coop_loss" | "abandoned"

/** How long a game lasted, in the unit that fits: whole minutes, at least one ("34 min"), and the hours once there are some ("1 h 05", "2 h 10"). */
export function lengthOf(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`
}

/** What a game did to a player's rank points, in the colour of the badge that says it: a gain is `success`, a loss `destructive`, and nothing to say (no change, or no points at all) `secondary`. */
export type PointsTone = "success" | "destructive" | "secondary"

/** The rank points a game gave ("+32") or took ("−11", with a real minus), "0" for a game that moved nothing and "—" where no points apply (`null`). */
export function pointsLabel(points: number | null): string {
  if (points === null) return "—"
  if (points > 0) return `+${points}`
  if (points < 0) return `−${Math.abs(points)}`
  return "0"
}

/** The tone of those points: green for a gain, red for a loss, grey for none. */
export function pointsTone(points: number | null): PointsTone {
  if (points === null || points === 0) return "secondary"
  return points > 0 ? "success" : "destructive"
}

/** The share of games won, in whole percent: null when no game was played, since there is nothing to share. */
export function winRate(wins: number, played: number): number | null {
  return played > 0 ? Math.round((wins / played) * 100) : null
}

/** What a player has won, in words: "14 wins in 24 games", "1 win in 1 game". */
export function recordOf(wins: number, played: number): string {
  return `${wins} ${wins === 1 ? "win" : "wins"} in ${played} ${played === 1 ? "game" : "games"}`
}
