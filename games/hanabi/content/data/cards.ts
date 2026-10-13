import type { SeedDoc } from "@pbgo/content-kit"
import { RANKS, SUIT_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { Rank, SuitKey } from "../../apps/studio/schemaTypes/constants.ts"
import { directionOf } from "./suits.ts"

/** Copies of each value in a firework built upwards: three 1s, two each of 2, 3 and 4, one 5. */
const ASCENDING: Record<Rank, number> = { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1 }

/** The black firework starts at 5, so its common card is the 5 and its scarce one the 1: the curve is the same one, turned around. */
const DESCENDING: Record<Rank, number> = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 3 }

export const cardId = (suit: SuitKey, rank: Rank) => `card-${suit}-${rank}`

export const quantityOf = (suit: SuitKey, rank: Rank): number => (directionOf(suit) === "descending" ? DESCENDING : ASCENDING)[rank]

/** The 35 faces of the 70-card deck: one document per suit and value, with the number of copies. */
export function buildCards(): SeedDoc[] {
  return SUIT_KEYS.flatMap((suit) =>
    RANKS.map((rank) => ({
      _id: cardId(suit, rank),
      _type: "card",
      suit,
      rank,
      quantity: quantityOf(suit, rank),
    })),
  )
}
