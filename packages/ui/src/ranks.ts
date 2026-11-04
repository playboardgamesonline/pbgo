// The rank of a player in a game, which is what the platform shows where it would show a rating. The rating (an Elo) stays on the server and is never sent to the browser, never drawn and never typed for a page: the server derives
// the rank from it and from the player's position among the game's players, and sends the tier and the division alone. Nothing here computes a rank: the file says what a rank is, how it is written and which one comes after it, and the hub draws what it is given.

/** The nine tiers, from the lowest to the highest. */
export const TIERS = ["Apprentice", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster", "Legend"] as const

export type Tier = (typeof TIERS)[number]

/** The division inside a tier: I the lowest, III the highest. */
export type Division = 1 | 2 | 3

/** A player's rank: a tier and, for each tier but Legend, the division inside it. Legend, the top of the board, has none. */
export type Rank = { tier: Exclude<Tier, "Legend">; division: Division } | { tier: "Legend"; division?: undefined }

const NUMERALS: Record<Division, string> = { 1: "I", 2: "II", 3: "III" }

/** A rank as it is written: "Gold II", and "Legend" alone. */
export function rankLabel(rank: Rank): string {
  return rank.tier === "Legend" ? rank.tier : `${rank.tier} ${NUMERALS[rank.division]}`
}

/** The rank above a rank: the next division of its tier, else the first division of the next tier, and Legend, which has none, above Grandmaster III. Null for Legend: nothing is above it. */
export function nextRank(rank: Rank): Rank | null {
  if (rank.tier === "Legend") return null
  if (rank.division < 3) return { tier: rank.tier, division: (rank.division + 1) as Division }
  const tier = TIERS[TIERS.indexOf(rank.tier) + 1]!
  return tier === "Legend" ? { tier } : { tier, division: 1 }
}
