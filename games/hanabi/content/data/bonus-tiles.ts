import { localeString } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"
import { BONUS_TILE_NUMBERS } from "../../apps/studio/schemaTypes/constants.ts"
import type { BonusTileKey, BonusTileNumber } from "../../apps/studio/schemaTypes/constants.ts"

export type TileSpec = { key: BonusTileKey; name: Localized }

// The rulebook numbers the six tiles and describes their effects; it gives them no name. The names are a first proposal and the
// English key is the stable id of a tile. A tile holds no effect text: the rules reach players as the rulebook's PDF links (`settings`).
// Whether the two clue tiles (3 and 4) cost a clue token is not stated in the rulebook or the spec: the engine will have to settle it.
// Exported so the tests can check the keys and the names by tile number.
export const TILE_SPECS: Record<BonusTileNumber, TileSpec> = {
  1: { key: "extraClue", name: { fr: "Jeton en plus", en: "Extra clue", es: "Pista extra", de: "Extra-Hinweis" } },
  2: { key: "repair", name: { fr: "Réparation", en: "Repair", es: "Reparación", de: "Reparatur" } },
  3: { key: "colorClue", name: { fr: "Information couleur", en: "Color clue", es: "Pista de color", de: "Farbhinweis" } },
  4: { key: "numberClue", name: { fr: "Information valeur", en: "Number clue", es: "Pista de número", de: "Zahlenhinweis" } },
  5: { key: "recycle", name: { fr: "Recyclage", en: "Recycle", es: "Reciclaje", de: "Recycling" } },
  6: { key: "secondChance", name: { fr: "Seconde chance", en: "Second chance", es: "Segunda oportunidad", de: "Zweite Chance" } },
}

export const bonusTileId = (number: BonusTileNumber) => `bonus-tile-${number}`

/** The six tiles of the 5 Flamboyants extension. */
export function buildBonusTiles(): SeedDoc[] {
  return BONUS_TILE_NUMBERS.map((number) => {
    const spec = TILE_SPECS[number]
    return {
      _id: bonusTileId(number),
      _type: "bonusTile",
      key: spec.key,
      number,
      name: localeString(spec.name),
    }
  })
}
