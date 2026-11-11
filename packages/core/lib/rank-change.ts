/**
 * What the game that has just ended at a table did to the rank points of the member who asks (`GET /api/<slug>/games/<code>/rank`, `server/rank-change.ts`). The game is written down a moment after it ends, from the request that ended it, so the
 * answer has three stages: not written yet (`recorded` false: ask again), written and not rated (a normal table, or a ranked one that counted for nobody: nothing to say), and rated, with the points it gave or took. The rating itself never goes
 * to a browser, only the points.
 */
export type RankChange = {
  /** The game is written down. */
  recorded: boolean
  /** It counted for the rank. */
  ranked: boolean
  /** The rank points it gave (+) or took (−), null while it is not known and for a game that counted for nobody. */
  points: number | null
}

/** Nothing is known yet: the game is not written down, or the visitor has no account to rate. */
export const NO_RANK_CHANGE: RankChange = { recorded: false, ranked: false, points: null }

/** How many times the end screen asks for the rank points of a game that is not written down yet, and how long it waits between two (milliseconds): the first answer comes in about a second, so this gives it more than ten. */
export const RANK_ASKS = { tries: 6, everyMs: 2_000 } as const
