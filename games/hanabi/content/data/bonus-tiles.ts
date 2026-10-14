import { localeString, localeText } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"
import { BONUS_TILE_NUMBERS } from "../../apps/studio/schemaTypes/constants.ts"
import type { BonusTileNumber } from "../../apps/studio/schemaTypes/constants.ts"

export type TileSpec = { name: Localized; effect: Localized }

// The rulebook numbers the six tiles and describes their effects; it gives them no name. The names are a first proposal.
// Whether the two clue tiles (3 and 4) cost a clue token is not stated in the rulebook or the spec, so the wording stays neutral.
// Exported so the rules page lists the same effects, by tile number.
export const TILE_SPECS: Record<BonusTileNumber, TileSpec> = {
  1: {
    name: { fr: "Jeton en plus", en: "Extra clue", es: "Pista extra", de: "Extra-Hinweis" },
    effect: {
      fr: "Vous récupérez un jeton Indice, dans la limite de 8 jetons disponibles.",
      en: "You take back one clue token, up to the maximum of 8 available.",
      es: "Recuperas una ficha de pista, sin pasar del máximo de 8 disponibles.",
      de: "Du bekommst ein Hinweisplättchen zurück – mehr als 8 sind nie verfügbar.",
    },
  },
  2: {
    name: { fr: "Réparation", en: "Repair", es: "Reparación", de: "Reparatur" },
    effect: {
      fr: "Retournez une tuile Erreur rouge sur sa face bleue et récupérez un jeton Indice. Sans erreur à réparer, vous récupérez quand même le jeton.",
      en: "Flip one used fuse token back to its blue side and take a clue token. If no fuse has been used yet, you still take the clue token.",
      es: "Da la vuelta a una ficha de error roja para dejarla por su cara azul y recupera una ficha de pista. Si no hay ningún error que reparar, recuperas la ficha de pista igualmente.",
      de: "Drehe ein verbrauchtes Fehlerplättchen auf seine blaue Seite zurück und nimm ein Hinweisplättchen. Gibt es noch keinen Fehler, bekommst du das Hinweisplättchen trotzdem.",
    },
  },
  3: {
    name: { fr: "Information couleur", en: "Color clue", es: "Pista de color", de: "Farbhinweis" },
    effect: {
      fr: "En bonus, donnez une information de couleur au joueur de votre choix.",
      en: "As a bonus, give a color clue to the player of your choice.",
      es: "Como bonificación, da una pista de color al jugador que elijas.",
      de: "Als Bonus gibst du einem Mitspieler deiner Wahl einen Farbhinweis.",
    },
  },
  4: {
    name: { fr: "Information valeur", en: "Number clue", es: "Pista de número", de: "Zahlenhinweis" },
    effect: {
      fr: "En bonus, donnez une information de valeur au joueur de votre choix.",
      en: "As a bonus, give a number clue to the player of your choice.",
      es: "Como bonificación, da una pista de número al jugador que elijas.",
      de: "Als Bonus gibst du einem Mitspieler deiner Wahl einen Zahlenhinweis.",
    },
  },
  5: {
    name: { fr: "Recyclage", en: "Recycle", es: "Reciclaje", de: "Recycling" },
    effect: {
      fr: "Reprenez la carte de votre choix dans la défausse, glissez-la dans la pioche puis remélangez celle-ci. Si la pioche est vide, vous pouvez appliquer à la place l’effet de « Seconde chance ».",
      en: "Pick a card from the discard pile and shuffle it into the draw pile. If the draw pile is empty, you may apply the “Second chance” effect instead.",
      es: "Elige una carta del descarte y mézclala con el mazo. Si el mazo está vacío, puedes aplicar en su lugar el efecto de «Segunda oportunidad».",
      de: "Wähle eine Karte vom Ablagestapel und mische sie in den Nachziehstapel. Ist der Nachziehstapel leer, darfst du stattdessen den Effekt „Zweite Chance“ anwenden.",
    },
  },
  6: {
    name: { fr: "Seconde chance", en: "Second chance", es: "Segunda oportunidad", de: "Zweite Chance" },
    effect: {
      fr: "Prenez la carte de votre choix dans la défausse et jouez-la sur-le-champ. Elle doit pouvoir rejoindre son feu d’artifice (un 4 bleu sur un 3 bleu, par exemple), sinon l’effet est perdu. Si vous posez ainsi un 5, une nouvelle tuile Bonus s’applique aussitôt.",
      en: "Pick a card from the discard pile and play it right away. It has to fit on its firework (a blue 4 on a blue 3, for example), otherwise the effect is lost. If you play a 5 this way, another bonus tile applies at once.",
      es: "Elige una carta del descarte y juégala de inmediato. Tiene que poder colocarse en su fuego artificial (un 4 azul sobre un 3 azul, por ejemplo); si no, el efecto se pierde. Si juegas así un 5, se aplica enseguida otra loseta de bonificación.",
      de: "Wähle eine Karte vom Ablagestapel und spiele sie sofort aus. Sie muss sich an ihr Feuerwerk anlegen lassen (zum Beispiel eine blaue 4 auf die blaue 3), sonst verfällt der Effekt. Spielst du so eine 5 aus, gilt sofort ein weiteres Bonusplättchen.",
    },
  },
}

export const bonusTileId = (number: BonusTileNumber) => `bonus-tile-${number}`

/** The six tiles of the 5 Flamboyants extension. */
export function buildBonusTiles(): SeedDoc[] {
  return BONUS_TILE_NUMBERS.map((number) => {
    const spec = TILE_SPECS[number]
    return {
      _id: bonusTileId(number),
      _type: "bonusTile",
      number,
      name: localeString(spec.name),
      effect: localeText(spec.effect),
    }
  })
}
