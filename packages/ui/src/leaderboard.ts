// What a game's leaderboard is made of for `@pbgo/ui/platform/leaderboard`: a row, and which rows the board draws. No React in this file, so that it is tested as it is. The hub's page makes its rows from the ratings of the
// game (`apps/web/src/lib/game-activity-props.ts`) and the board draws what it is given.

/** A player on a leaderboard, as the board draws them. */
export type LeaderboardRow = {
  /** Tells the rows apart, and the visitor's own among them. */
  id: string
  /** Their place: 1 is the best. Null while they are not ranked yet, a player being ranked only after a few games. */
  rank: number | null
  name: string
  avatarUrl?: string | null
  /** What the board is ordered by (an Elo rating, 1500 to start with); it is drawn as a whole number. */
  rating: number
  wins: number
  /** How many ranked games they have played. */
  played: number
}

/** What a board draws. */
export type Board = {
  /** The best players, best first. */
  rows: LeaderboardRow[]
  /** The visitor's own row, when they are signed in and not among `rows`: it is drawn after them. */
  own: LeaderboardRow | null
  /** Whether other players stand between `rows` and `own`, so that the board says so. */
  gap: boolean
}

/**
 * The rows of a board: the first `size` of the top, then the visitor's own row if they are not among them, with a gap when the rows do not run on into it (a visitor who is 11th under a top of 10 is next to it, one who is 40th or not
 * ranked yet is not). The visitor's row is found by its `id`, wherever it is.
 */
export function boardOf(top: readonly LeaderboardRow[], you: LeaderboardRow | null | undefined, size: number): Board {
  const rows = top.slice(0, Math.max(0, size))
  const own = you && !rows.some((row) => row.id === you.id) ? you : null
  const gap = own !== null && rows.length > 0 && (own.rank === null || own.rank > rows.length + 1)
  return { rows, own, gap }
}
