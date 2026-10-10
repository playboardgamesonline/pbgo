import type { Rng } from "./rng"
import { FAMILIES, type Courtier, type Role } from "./types"

export const FAMILY_COMPOSITION: { role: Role | null; count: number }[] = [
  { role: "noble", count: 4 },
  { role: "spy", count: 2 },
  { role: "assassin", count: 2 },
  { role: "guard", count: 3 },
  { role: null, count: 4 },
]

export const SET_ASIDE_CARDS: Record<number, number> = { 2: 30, 3: 18, 4: 6, 5: 0 }
export const HAND_SIZE = 3
export const MISSION_POINTS = 3

/**
 * The 90 courtiers. Their ids are placeholders that encode the family: `setupGame` replaces them with opaque ids
 * once the deck is shuffled (see `assignOpaqueIds`), so they never reach a client.
 */
export function createCourtiers(): Courtier[] {
  return FAMILIES.flatMap((family) =>
    FAMILY_COMPOSITION.flatMap(({ role, count }) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${family}-${role ?? "courtier"}-${i + 1}`,
        family,
        role,
      })),
    ),
  )
}

/**
 * Gives each card of a *shuffled* deck an opaque id drawn from `rng`, in deck order: an id only tells a card's
 * position in the secret deal, never its family or role. `rng` must not be the shuffle's stream (see `sideSeed`).
 */
export function assignOpaqueIds(shuffled: readonly Courtier[], rng: Rng): Courtier[] {
  const used = new Set<string>()
  return shuffled.map((card) => {
    let id: string
    do id = `c${Math.floor(rng() * 36 ** 6).toString(36).padStart(6, "0")}`
    while (used.has(id))
    used.add(id)
    return { ...card, id }
  })
}

export function weight(card: Courtier): number {
  return card.role === "noble" ? 2 : 1
}
