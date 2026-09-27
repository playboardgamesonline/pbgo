import { FAMILLES, type Courtisan, type Role } from "./types"

export const COMPOSITION_FAMILLE: { role: Role | null; nombre: number }[] = [
  { role: "noble", nombre: 4 },
  { role: "espion", nombre: 2 },
  { role: "assassin", nombre: 2 },
  { role: "garde", nombre: 3 },
  { role: null, nombre: 4 },
]

export const CARTES_ECARTEES: Record<number, number> = { 2: 30, 3: 18, 4: 6, 5: 0 }
export const TAILLE_MAIN = 3
export const POINTS_MISSION = 3

export function creerCourtisans(): Courtisan[] {
  return FAMILLES.flatMap((famille) =>
    COMPOSITION_FAMILLE.flatMap(({ role, nombre }) =>
      Array.from({ length: nombre }, (_, i) => ({
        id: `${famille}-${role ?? "courtisan"}-${i + 1}`,
        famille,
        role,
      })),
    ),
  )
}

export function poids(carte: Courtisan): number {
  return carte.role === "noble" ? 2 : 1
}
