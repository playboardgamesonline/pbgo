import { localeString } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"
import { CARD_TYPE_KEYS, CATEGORIES, PLACES } from "../../apps/studio/schemaTypes/constants.ts"
import type { CardTypeKey } from "../../apps/studio/schemaTypes/constants.ts"

type CardTypeSpec = {
  name: Localized
  /** Different illustrations the Original Edition prints for this type (the art slots follow this count). */
  illustrations: number
}

// A card type holds its name and its illustrations, nothing else (no effect text: what a card does is the engine's and the publisher's rules).
// Names follow the glossary of the rules spec. The five cats keep their English names in every language (no sourced translation);
// the FR, ES and DE names are listed as "needs native review" in the pull request.
const SPECS: Record<CardTypeKey, CardTypeSpec> = {
  "exploding-kitten": {
    name: { fr: "Exploding Kitten", en: "Exploding Kitten", es: "Exploding Kitten", de: "Exploding Kitten" },
    illustrations: 4,
  },
  defuse: {
    name: { fr: "Kit de désamorçage", en: "Defuse", es: "Desactivación", de: "Entschärfung" },
    illustrations: 6,
  },
  attack: {
    name: { fr: "Attaque", en: "Attack", es: "Ataque", de: "Angriff" },
    illustrations: 4,
  },
  skip: {
    name: { fr: "Passe-tour", en: "Skip", es: "Salta", de: "Hops!" },
    illustrations: 4,
  },
  favor: {
    name: { fr: "Faveur", en: "Favor", es: "Favor", de: "Wunsch" },
    illustrations: 4,
  },
  shuffle: {
    name: { fr: "Mélange", en: "Shuffle", es: "Barajar", de: "Mischen" },
    illustrations: 4,
  },
  "see-the-future": {
    name: { fr: "Divination", en: "See the Future", es: "Ver el futuro", de: "Blick in die Zukunft" },
    illustrations: 5,
  },
  nope: {
    name: { fr: "Non", en: "Nope", es: "Nope", de: "NÖ!" },
    illustrations: 5,
  },
  tacocat: {
    name: { fr: "Tacocat", en: "Tacocat", es: "Tacocat", de: "Tacocat" },
    illustrations: 1,
  },
  cattermelon: {
    name: { fr: "Cattermelon", en: "Cattermelon", es: "Cattermelon", de: "Cattermelon" },
    illustrations: 1,
  },
  "hairy-potato-cat": {
    name: { fr: "Hairy Potato Cat", en: "Hairy Potato Cat", es: "Hairy Potato Cat", de: "Hairy Potato Cat" },
    illustrations: 1,
  },
  "beard-cat": {
    name: { fr: "Beard Cat", en: "Beard Cat", es: "Beard Cat", de: "Beard Cat" },
    illustrations: 1,
  },
  "rainbow-ralphing-cat": {
    name: { fr: "Rainbow-Ralphing Cat", en: "Rainbow-Ralphing Cat", es: "Rainbow-Ralphing Cat", de: "Rainbow-Ralphing Cat" },
    illustrations: 1,
  },
}

/** `<category>-card-<key>` (`action-card-attack`, `cat-card-tacocat`): a card type is filed in the category of its kind, and its id says which. */
export const cardTypeId = (key: CardTypeKey) => `${PLACES[key].category}-card-${key}`

/** Key of an illustration in the `illustrations` array of a card type: stable, so a second run finds the same items and the art is placed by key. */
export const illustrationKey = (number: number) => `art-${number}`

/** How many illustrations a card type has, numbered from 1 like the art files; the art slots are built from it. */
export const illustrationCount = (key: CardTypeKey) => SPECS[key].illustrations

/** The 13 card types, in the order of the engine catalogue, each a document of the type of its category. */
export function buildCardTypes(): SeedDoc[] {
  return CARD_TYPE_KEYS.map((key) => {
    const spec = SPECS[key]
    const { category, order } = PLACES[key]
    return {
      _id: cardTypeId(key),
      _type: CATEGORIES[category].type,
      key,
      order,
      name: localeString(spec.name),
      illustrations: Array.from({ length: spec.illustrations }, (_, i) => ({ _key: illustrationKey(i + 1), _type: "illustration", number: i + 1 })),
    }
  })
}
