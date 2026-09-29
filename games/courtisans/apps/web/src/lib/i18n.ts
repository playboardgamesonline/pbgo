export const LANGUES = ["fr", "en"] as const
export type Langue = (typeof LANGUES)[number]

export const LANGUE_PAR_DEFAUT: Langue = "fr"

export type Localise<T = string> = Partial<Record<Langue, T | null>> | null | undefined

export function traduire<T>(valeur: Localise<T>, langue: Langue = LANGUE_PAR_DEFAUT): T | undefined {
  if (!valeur) return undefined
  return valeur[langue] ?? valeur[LANGUE_PAR_DEFAUT] ?? LANGUES.map((l) => valeur[l]).find((v) => v != null) ?? undefined
}
