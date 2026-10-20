import { localeString, localeText } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"
import { CARD_TYPE_KEYS, CATEGORIES, PLACES } from "../../apps/studio/schemaTypes/constants.ts"
import type { CardTypeKey } from "../../apps/studio/schemaTypes/constants.ts"

type CardTypeSpec = {
  name: Localized
  /** A short summary of the effect in PBGO's own words; the rules page has the full version. */
  effect: Localized
  /** Different illustrations the Original Edition prints for this type (the art slots follow this count). */
  illustrations: number
}

// Names follow the glossary of the rules spec. The five cats keep their English names in every language (no sourced translation);
// the FR, ES and DE names and summaries are listed as "needs native review" in the pull request.
// Registers follow the site's translations: vous (fr), you (en), tú (es), du (de).
const CAT_EFFECT: Localized = {
  fr: "Ne fait rien seule. Jouée en deux ou trois pareilles, elle permet de prendre une carte à une autre personne.",
  en: "Does nothing on its own. Played as a pair or a three of a kind, it takes a card from another player.",
  es: "No hace nada por sí sola. Jugada en pareja o en trío, permite quitar una carta a otra persona.",
  de: "Hat allein keine Wirkung. Als Pärchen oder Drilling gespielt, nimmt sie einer anderen Person eine Karte ab.",
}

const SPECS: Record<CardTypeKey, CardTypeSpec> = {
  "exploding-kitten": {
    name:{ fr: "Exploding Kitten", en: "Exploding Kitten", es: "Exploding Kitten", de: "Exploding Kitten" },
    effect: {
      fr: "Qui la pioche explose et quitte la partie, à moins de jouer aussitôt un Kit de désamorçage.",
      en: "Whoever draws it explodes and is out of the game, unless a Defuse is played right away.",
      es: "Quien la roba explota y queda fuera de la partida, a menos que juegue una Desactivación de inmediato.",
      de: "Wer sie zieht, explodiert und scheidet aus dem Spiel aus – außer, es folgt sofort eine Entschärfung.",
    },
    illustrations: 4,
  },
  defuse: {
    name:{ fr: "Kit de désamorçage", en: "Defuse", es: "Desactivación", de: "Entschärfung" },
    effect: {
      fr: "Vous sauve d’un Exploding Kitten que vous venez de piocher : le chaton retourne dans la pioche, à l’endroit de votre choix, sans que personne le voie.",
      en: "Saves you from an Exploding Kitten you just drew. The kitten goes back into the draw pile, anywhere you like, in secret.",
      es: "Te salva de un Exploding Kitten que acabas de robar. El gatito vuelve al mazo, donde quieras y en secreto.",
      de: "Rettet vor einem gerade gezogenen Exploding Kitten: Das Kätzchen wird heimlich an eine beliebige Stelle des Spielstapels zurückgesteckt.",
    },
    illustrations: 6,
  },
  attack: {
    name:{ fr: "Attaque", en: "Attack", es: "Ataque", de: "Angriff" },
    effect: {
      fr: "Termine votre tour sans piocher. La personne suivante doit jouer 2 tours de suite.",
      en: "Ends your turn without drawing. The next player has to take 2 turns in a row.",
      es: "Termina tu turno sin robar. La siguiente persona debe jugar 2 turnos seguidos.",
      de: "Beendet den eigenen Zug, ohne zu ziehen. Die nächste Person muss 2 Züge hintereinander spielen.",
    },
    illustrations: 4,
  },
  skip: {
    name:{ fr: "Passe-tour", en: "Skip", es: "Salta", de: "Hops!" },
    effect: {
      fr: "Termine l’un de vos tours sans piocher. Si vous subissez une Attaque, il vous reste l’autre tour à jouer.",
      en: "Ends one of your turns without drawing. If you were attacked, you still owe the other turn.",
      es: "Termina uno de tus turnos sin robar. Si te han atacado, aún debes jugar el otro turno.",
      de: "Beendet einen deiner Züge, ohne zu ziehen. Bei einem Angriff bleibt der andere Zug trotzdem offen.",
    },
    illustrations: 4,
  },
  favor: {
    name:{ fr: "Faveur", en: "Favor", es: "Favor", de: "Wunsch" },
    effect: {
      fr: "Désignez une autre personne : elle choisit une carte de sa main et vous la donne.",
      en: "Choose another player: they pick a card from their hand and give it to you.",
      es: "Elige a otra persona: escoge una carta de su mano y te la da.",
      de: "Wähle eine andere Person: Sie sucht eine Karte aus ihrer Hand aus und gibt sie dir.",
    },
    illustrations: 4,
  },
  shuffle: {
    name:{ fr: "Mélange", en: "Shuffle", es: "Barajar", de: "Mischen" },
    effect: {
      fr: "Mélange la pioche au hasard.",
      en: "Shuffles the draw pile at random.",
      es: "Baraja el mazo al azar.",
      de: "Mischt den Spielstapel zufällig durch.",
    },
    illustrations: 4,
  },
  "see-the-future": {
    name:{ fr: "Divination", en: "See the Future", es: "Ver el futuro", de: "Blick in die Zukunft" },
    effect: {
      fr: "Regardez en secret les 3 cartes du dessus de la pioche, puis remettez-les dans le même ordre.",
      en: "Look at the top 3 cards of the draw pile in secret, then put them back in the same order.",
      es: "Mira en secreto las 3 primeras cartas del mazo y déjalas en el mismo orden.",
      de: "Schau dir heimlich die obersten 3 Karten des Spielstapels an und lege sie in derselben Reihenfolge zurück.",
    },
    illustrations: 5,
  },
  nope: {
    name:{ fr: "Non", en: "Nope", es: "Nope", de: "NÖ!" },
    effect: {
      fr: "Annule une action qui vient d’être jouée, ou un autre Non. Peut se jouer hors de votre tour, tant que la fenêtre de Non est ouverte.",
      en: "Cancels an action that was just played, or another Nope. Can be played out of turn, as long as the Nope window is open.",
      es: "Cancela una acción recién jugada, o a otro Nope. Se puede jugar fuera de turno mientras la ventana de Nope esté abierta.",
      de: "Hebt eine gerade gespielte Aktion auf – oder ein anderes NÖ! Kann außerhalb des eigenen Zugs gespielt werden, solange das Nö-Fenster offen ist.",
    },
    illustrations: 5,
  },
  tacocat: {
    name:{ fr: "Tacocat", en: "Tacocat", es: "Tacocat", de: "Tacocat" },
    effect: CAT_EFFECT,
    illustrations: 1,
  },
  cattermelon: {
    name:{ fr: "Cattermelon", en: "Cattermelon", es: "Cattermelon", de: "Cattermelon" },
    effect: CAT_EFFECT,
    illustrations: 1,
  },
  "hairy-potato-cat": {
    name:{ fr: "Hairy Potato Cat", en: "Hairy Potato Cat", es: "Hairy Potato Cat", de: "Hairy Potato Cat" },
    effect: CAT_EFFECT,
    illustrations: 1,
  },
  "beard-cat": {
    name:{ fr: "Beard Cat", en: "Beard Cat", es: "Beard Cat", de: "Beard Cat" },
    effect: CAT_EFFECT,
    illustrations: 1,
  },
  "rainbow-ralphing-cat": {
    name:{ fr: "Rainbow-Ralphing Cat", en: "Rainbow-Ralphing Cat", es: "Rainbow-Ralphing Cat", de: "Rainbow-Ralphing Cat" },
    effect: CAT_EFFECT,
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
      effect: localeText(spec.effect),
      illustrations: Array.from({ length: spec.illustrations }, (_, i) => ({ _key: illustrationKey(i + 1), _type: "illustration", number: i + 1 })),
    }
  })
}
