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

export function weight(card: Courtier): number {
  return card.role === "noble" ? 2 : 1
}
