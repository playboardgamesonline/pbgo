import { localeString } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"

export const FAMILY_KEYS = ["butterfly", "toad", "nightingale", "hare", "stag", "carp"] as const
export type FamilyKey = (typeof FAMILY_KEYS)[number]

// Copied from `GAME[locale].families[key].name` of `src/lib/i18n.ts`; `parity/code.test.ts` keeps both equal until the code's copy goes.
const NAMES: Record<FamilyKey, Localized> = {
  butterfly: { fr: "Papillon", en: "Butterfly", es: "Mariposa", de: "Schmetterling" },
  toad: { fr: "Crapaud", en: "Toad", es: "Sapo", de: "Kröte" },
  nightingale: { fr: "Rossignol", en: "Nightingale", es: "Ruiseñor", de: "Nachtigall" },
  hare: { fr: "Lièvre", en: "Hare", es: "Liebre", de: "Hase" },
  stag: { fr: "Cerf", en: "Stag", es: "Ciervo", de: "Hirsch" },
  carp: { fr: "Carpe", en: "Carp", es: "Carpa", de: "Karpfen" },
}

export const familyId = (key: FamilyKey) => `family-${key}`

/**
 * The names of the six families. The documents already exist in the Studio (key, colour, pictogram): only `name` is seeded, so a run
 * fills the languages that are missing and leaves everything else as it is.
 */
export function buildFamilies(): SeedDoc[] {
  return FAMILY_KEYS.map((key) => ({ _id: familyId(key), _type: "family", name: localeString(NAMES[key]) }))
}
