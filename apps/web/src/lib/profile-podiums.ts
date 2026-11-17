import { lengthOf } from "@pbgo/ui/results"
import type { GameTotals } from "@pbgo/accounts"

// The podiums of a profile's two zones: the games a member spent the most time at, and the games they win the most often. Pure, so that they are tested as they are; the page gives each game its picture from the catalog.

/** A game on a podium: which, what put it there, written as the page shows it inside its bar, and the amount that the height of the bar is proportional to (the seconds played, the share won). */
export type PodiumGame = { slug: string; name: string; value: string; amount: number }

/** How many places a podium has: the first two. */
export const PODIUM_PLACES = 2

/**
 * The two games they spent the most time at, the most first: more time, then more games played, then the name. A game with no time told (its games had no start) is not on it.
 */
export function playtimePodium(perGame: readonly GameTotals[]): PodiumGame[] {
  return perGame
    .filter((row) => (row.seconds ?? 0) > 0)
    .toSorted((a, b) => (b.seconds ?? 0) - (a.seconds ?? 0) || b.played - a.played || a.name.localeCompare(b.name))
    .slice(0, PODIUM_PLACES)
    .map((row) => ({ slug: row.slug, name: row.name, value: lengthOf(row.seconds ?? 0), amount: row.seconds ?? 0 }))
}

/**
 * The two games they win the most often, the best share first (the share of games won, not rounded), then the more played, then the name. A game they never won is not on it, and the value is the share in whole percent, as everywhere else on the profile (the bars are proportional to the share itself).
 */
export function winRatePodium(perGame: readonly GameTotals[]): PodiumGame[] {
  return perGame
    .filter((row) => row.played > 0 && row.wins > 0)
    .toSorted((a, b) => b.wins / b.played - a.wins / a.played || b.played - a.played || a.name.localeCompare(b.name))
    .slice(0, PODIUM_PLACES)
    .map((row) => ({ slug: row.slug, name: row.name, value: `${Math.round((row.wins / row.played) * 100)}%`, amount: row.wins / row.played }))
}
