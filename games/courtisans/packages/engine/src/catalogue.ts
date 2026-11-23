/**
 * The box of Courtisans, as data.
 *
 * - `CARDS`: every kind of card, by key. The keys are a contract: they are what a picture of the game's Sanity is found by (`cardKey`). Append only, never rename.
 * - `COMPOSITION`: what a family holds, how many courtiers of each role (the plain ones have none).
 * - `CATALOGUE`: every card of the box, one after the other, by kind: 90, family by family. A card is its index in it; it is never stored (lean state, PLT-45): the state holds the opaque id each index holds.
 *
 * The rules read the family and the role of a card, and the weight a role gives it, never a key.
 */

export const FAMILIES = ["butterfly", "toad", "nightingale", "hare", "stag", "carp"] as const
export type Family = (typeof FAMILIES)[number]

export const ROLES = ["noble", "spy", "assassin", "guard"] as const
export type Role = (typeof ROLES)[number]

/** What one family holds: how many courtiers of each role, the plain ones (no role) last. */
export const COMPOSITION: readonly { role: Role | null; count: number }[] = [
  { role: "noble", count: 4 },
  { role: "spy", count: 2 },
  { role: "assassin", count: 2 },
  { role: "guard", count: 3 },
  { role: null, count: 4 },
]

/** The key of a kind of card: `noble-hare`, and `base-hare` for a courtier with no role. */
export type CardKey = `${Role | "base"}-${Family}`

export function cardKey(family: Family, role: Role | null): CardKey {
  return `${role ?? "base"}-${family}`
}

export type CardType = { family: Family; role: Role | null }

/** Every kind of card: a family and a role (or none). */
export const CARDS = Object.fromEntries(FAMILIES.flatMap((family) => [null, ...ROLES].map((role) => [cardKey(family, role), { family, role }]))) as Record<CardKey, CardType>

/** Every card of the box, kind by kind, in the order of `COMPOSITION`, family after family: a card is its index here. */
export const CATALOGUE: readonly CardKey[] = FAMILIES.flatMap((family) => COMPOSITION.flatMap(({ role, count }) => Array.from({ length: count }, () => cardKey(family, role))))

/** How much a card counts for in a family's standing and in the points of a domain: a noble counts twice, every other card once. */
export function weight(role: Role | null): number {
  return role === "noble" ? 2 : 1
}

/** How many cards are put aside, face down, at the start, by number of players: nobody looks at them and they are never played. */
export const SET_ASIDE_CARDS: Readonly<Record<number, number>> = { 2: 30, 3: 18, 4: 6, 5: 0 }

/** The cards a player holds, and draws back to at the end of their turn. */
export const HAND_SIZE = 3

/** What a mission that holds is worth at the end. */
export const MISSION_POINTS = 3
