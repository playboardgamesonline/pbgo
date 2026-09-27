export const FAMILLES = ["papillon", "crapaud", "rossignol", "lievre", "cerf", "carpe"] as const
export type Famille = (typeof FAMILLES)[number]
