import { localeString } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"
import { RANKS, RATING_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { Rank, RatingKey } from "../../apps/studio/schemaTypes/constants.ts"

type RatingSpec = { minScore: number; label: Localized; line: Localized }

// Seven ratings: the six of the 25-point scale, plus one for a perfect 30 with a sixth firework.
// The thresholds follow the rulebook; the labels are the names of the rulebook's ratings and the lines are PBGO's own.
const RATINGS: Record<RatingKey, RatingSpec> = {
  risible: {
    minScore: 0,
    label: { fr: "Risible", en: "Laughable", es: "Risible", de: "Lächerlich" },
    line: {
      fr: "Le public se moque, et vous aussi, un peu.",
      en: "The crowd is laughing, and not with you.",
      es: "Risas entre el público, y no precisamente de admiración.",
      de: "Das Publikum lacht – und nicht mit euch.",
    },
  },
  mediocre: {
    minScore: 6,
    label: { fr: "Médiocre", en: "Mediocre", es: "Mediocre", de: "Mittelmäßig" },
    line: {
      fr: "Des bravos tièdes, et déjà on parle d’autre chose.",
      en: "A few lukewarm cheers, then everyone heads home.",
      es: "Aplausos tibios y todos a casa.",
      de: "Lauer Applaus, dann geht jeder nach Hause.",
    },
  },
  honorable: {
    minScore: 11,
    label: { fr: "Honorable", en: "Honorable", es: "Honorable", de: "Respektabel" },
    line: {
      fr: "Un spectacle correct : on a bien regardé en l’air.",
      en: "A decent show: people did look up.",
      es: "Un espectáculo digno: la gente levantó la vista.",
      de: "Eine ordentliche Show: Man hat immerhin nach oben geschaut.",
    },
  },
  excellent: {
    minScore: 16,
    label: { fr: "Excellente", en: "Excellent", es: "Excelente", de: "Ausgezeichnet" },
    line: {
      fr: "Le ciel s’embrase et la foule en redemande.",
      en: "The sky lights up and the crowd wants more.",
      es: "El cielo se ilumina y el público pide más.",
      de: "Der Himmel leuchtet, das Publikum will mehr.",
    },
  },
  extraordinary: {
    minScore: 21,
    label: { fr: "Extraordinaire", en: "Extraordinary", es: "Extraordinario", de: "Außergewöhnlich" },
    line: {
      fr: "Un feu d’artifice dont on parlera pendant des années.",
      en: "A show people will be talking about for years.",
      es: "Un espectáculo del que se hablará durante años.",
      de: "Eine Show, über die man noch Jahre sprechen wird.",
    },
  },
  legendary: {
    minScore: 25,
    label: { fr: "Légendaire", en: "Legendary", es: "Legendario", de: "Legendär" },
    line: {
      fr: "Silence total, puis l’ovation : on a vu l’impossible.",
      en: "Total silence, then a standing ovation: you pulled off the impossible.",
      es: "Silencio absoluto y, después, una ovación: lo imposible existe.",
      de: "Atemlose Stille, dann tosender Applaus: Das Unmögliche ist gelungen.",
    },
  },
  divine: {
    minScore: 30,
    label: { fr: "Divine", en: "Divine", es: "Divino", de: "Göttlich" },
    line: {
      fr: "Même les étoiles ont applaudi.",
      en: "Even the stars applauded.",
      es: "Hasta las estrellas aplaudieron.",
      de: "Sogar die Sterne haben applaudiert.",
    },
  },
}

export type ScaleStep = { key: RatingKey; from: number; to: number; label: Localized }

/** The scale as score ranges (0–5, 6–10…), derived from the thresholds so the rules page cannot drift from the `game` document. The top rating has a single value. */
export function ratingScale(): ScaleStep[] {
  return RATING_KEYS.map((key, index) => {
    const next = RATING_KEYS[index + 1]
    const from = RATINGS[key].minScore
    return { key, from, to: next ? RATINGS[next].minScore - 1 : from, label: RATINGS[key].label }
  })
}

/** Keys of the array items: stable, so a second run finds the same items and the art can be placed by key. */
export const valueGlyphKey = (rank: Rank) => `v${rank}`
export const ratingItemKey = (key: RatingKey) => key

export const GAME_ID = "game"

/** The `game` singleton: the items of its two lists. The images (mat, card back, tokens, glyphs, badges) come with the art. */
export function buildGame(): SeedDoc {
  return {
    _id: GAME_ID,
    _type: "game",
    valueGlyphs: RANKS.map((rank) => ({ _key: valueGlyphKey(rank), _type: "valueGlyph", rank })),
    scoreScale: RATING_KEYS.map((key) => {
      const spec = RATINGS[key]
      return {
        _key: ratingItemKey(key),
        _type: "rating",
        key,
        minScore: spec.minScore,
        label: localeString(spec.label),
        line: localeString(spec.line),
      }
    }),
  }
}
