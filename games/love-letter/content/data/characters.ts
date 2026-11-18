import type { SeedDoc } from "@pbgo/content-kit"
import { CHARACTER_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { CharacterKey } from "../../apps/studio/schemaTypes/constants.ts"

/** A text with the languages that have a source: Spanish and German are left out, gaps for the Studio, and never a translation the seed cannot source. */
type Said = { fr: string; en: string }

type CharacterSpec = {
  /** The number printed on the card, 0 to 9 (2025 rulebook, p. 2): the higher value wins a comparison. */
  value: number
  /** Copies of the character among the 21 cards (rulebook, p. 2). */
  quantity: number
  /** The name. English: the 2025 rulebook, p. 2. French: p. 2 of the publisher's French demo leaflet (© 2019 Z-Man Games, a document apart from the rulebook), which prints the ten names: a source for these names only, never for rules. */
  name: Said
  /** The text to display on the card's plate: the faces are blank plates, so what a player reads on a card is written here. */
  text: Said
}

// The ten characters, in the order of the values. A character carries no effect or rule field: what a card does is the engine's, and the rules are the publisher's PDFs linked in `settings`.
// The card text is the one exception, a text to display, by decision. The English was written for the platform from the rules spec (docs/games/love-letter/rules.md, the table "The characters" and the sections under Rules), in its own words and not
// the publisher's; the French is a DRAFT in our own wording, for the owner to read before it is published (its terms are the leaflet's: manche, quitter la manche, en lice, pion Faveur, main, paquet, défausser). Spanish and German have no source yet: they stay empty.
// A text fits the plate of its face, three lines on the shorter one (see "Pictures" in this game's CLAUDE.md): `data.test.ts` keeps the budgets.
const SPECS: Record<CharacterKey, CharacterSpec> = {
  spy: {
    value: 0,
    quantity: 2,
    name: { fr: "Espionne", en: "Spy" },
    text: {
      en: "Does nothing. At the round’s end, you earn a favor token if, of the players still in, only you have played or discarded a Spy.",
      fr: "Sans effet. En fin de manche, vous gagnez un pion Faveur si, parmi ceux en lice, vous seul avez joué ou défaussé une Espionne.",
    },
  },
  guard: {
    value: 1,
    quantity: 6,
    name: { fr: "Garde", en: "Guard" },
    text: {
      en: "Guess another player’s card by naming any character but the Guard: a right guess knocks them out of the round.",
      fr: "Devinez la carte d’un autre joueur en nommant n’importe quel personnage sauf le Garde. Si c’est juste, il quitte la manche.",
    },
  },
  priest: {
    value: 2,
    quantity: 2,
    name: { fr: "Prêtre", en: "Priest" },
    text: {
      en: "Peek at another player’s hand in private.",
      fr: "Jetez un œil en secret à la main d’un autre joueur.",
    },
  },
  baron: {
    value: 3,
    quantity: 2,
    name: { fr: "Baron", en: "Baron" },
    text: {
      en: "Compare hands in secret with another player: the weaker card’s holder is knocked out of the round. A tie spares both.",
      fr: "Comparez vos mains en secret avec un autre joueur : le détenteur de la carte la moins forte quitte la manche. Égalité : personne.",
    },
  },
  handmaid: {
    value: 4,
    quantity: 2,
    name: { fr: "Servante", en: "Handmaid" },
    text: {
      en: "Until your turn comes round again, no other player’s card can pick you.",
      fr: "Jusqu’à votre prochain tour, aucune carte des autres joueurs ne peut vous désigner.",
    },
  },
  prince: {
    value: 5,
    quantity: 2,
    name: { fr: "Prince", en: "Prince" },
    text: {
      en: "Pick any player, you included: their hand is discarded and they draw a new card.",
      fr: "Désignez un joueur, vous compris : sa main est défaussée et il pioche une nouvelle carte.",
    },
  },
  chancellor: {
    value: 6,
    quantity: 2,
    name: { fr: "Chancelier", en: "Chancellor" },
    text: {
      en: "Draw two cards, keep one of your three and slide the other two face down beneath the deck, in the order you like.",
      fr: "Piochez deux cartes, gardez-en une sur vos trois et glissez les deux autres sous le paquet, face cachée.",
    },
  },
  king: {
    value: 7,
    quantity: 1,
    name: { fr: "Roi", en: "King" },
    text: {
      en: "Pick another player and swap hands with them.",
      fr: "Échangez votre carte avec celle d’un autre joueur.",
    },
  },
  countess: {
    value: 8,
    quantity: 1,
    name: { fr: "Comtesse", en: "Countess" },
    text: {
      en: "Does nothing, but you must play her whenever your other card is the King or a Prince.",
      fr: "Sans effet. Si vous détenez aussi le Roi ou un Prince, c’est elle que vous devez jouer.",
    },
  },
  princess: {
    value: 9,
    quantity: 1,
    name: { fr: "Princesse", en: "Princess" },
    text: {
      en: "Whenever she is played or discarded, even by force, her owner is knocked out of the round.",
      fr: "Jouée ou défaussée, même de force, elle fait quitter la manche à son propriétaire.",
    },
  },
}

/** A `localeString` and a `localeText` of the shared Studio schema with the languages that have a text. The content kit's builders refuse an empty language; here Spanish and German stay empty on purpose. */
const localeStringOf = ({ fr, en }: Said) => ({ _type: "localeString" as const, fr, en })
const localeTextOf = ({ fr, en }: Said) => ({ _type: "localeText" as const, fr, en })

/** The `_id` of a character: `character-spy`, `character-princess`. */
export const characterId = (key: CharacterKey) => `character-${key}`

/** A character of the game: its key in the Studio and its `_id`. */
export type CharacterRef = { key: CharacterKey; id: string }

/** The ten characters, in the order of the values. */
export const CHARACTER_LIST: CharacterRef[] = CHARACTER_KEYS.map((key) => ({ key, id: characterId(key) }))

/** The seed documents of the ten characters. */
export function buildCharacters(): SeedDoc[] {
  return CHARACTER_LIST.map(({ key, id }) => {
    const { value, quantity, name, text } = SPECS[key]
    return { _id: id, _type: "character", key, value, name: localeStringOf(name), text: localeTextOf(text), quantity }
  })
}
