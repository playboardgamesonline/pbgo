import { localeText } from "@pbgo/content-kit"
import type { SeedDoc } from "@pbgo/content-kit"

export const TEXTS_ID = "texts"

/**
 * The words the engine names by key instead of carrying them (docs/engine/01-the-game/07-parameters.md, "The words of options and scores"): the one option of a table and the lines of the score of a player. The keys are the engine's
 * (`option.<option>.label`, `option.<option>.help`, `score.<line>`), and `parity/engine.test.ts` keeps this list equal to what `engineTextKeys` asks of the engine. French is the booklet's and the engine's own words, English is the base every
 * language falls back to, Spanish and German are written to read: they are for the owner to check in the Studio.
 */
export const ENGINE_TEXTS = [
  {
    key: "option.targetScore.label",
    fr: "Score à atteindre",
    en: "Target score",
    es: "Puntuación objetivo",
    de: "Zielpunktzahl",
  },
  {
    key: "option.targetScore.help",
    fr: "À la fin d’une manche, le premier à atteindre ce total remporte la partie : 200 points dans les règles, moins pour une partie plus courte.",
    en: "At the end of a round, the first player to reach this total wins the game: 200 points in the rules, fewer for a shorter game.",
    es: "Al final de una ronda, el primero en alcanzar este total gana la partida: 200 puntos según las reglas, menos para una partida más corta.",
    de: "Am Ende einer Runde gewinnt, wer als Erstes diese Punktzahl erreicht: 200 Punkte nach den Regeln, weniger für ein kürzeres Spiel.",
  },
  { key: "score.rounds", fr: "Manches jouées", en: "Rounds played", es: "Rondas jugadas", de: "Gespielte Runden" },
  { key: "score.bestRound", fr: "Meilleure manche", en: "Best round", es: "Mejor ronda", de: "Beste Runde" },
  { key: "score.flip7", fr: "Flip 7 réussis", en: "Flip 7s made", es: "Flip 7 logrados", de: "Geschaffte Flip 7" },
  { key: "score.busts", fr: "Manches ratées", en: "Busted rounds", es: "Rondas fallidas", de: "Verpatzte Runden" },
]

/**
 * The part of the shared `texts` document that the seed fills: the engine's words, one keyed item each, so that the seed adds the ones Sanity lacks and keeps the ones edited in the Studio. Everything else of Copy (the interface labels, the
 * error messages, the victory phrases) is set in the Studio and left alone.
 */
export function buildTexts(): SeedDoc {
  return {
    _id: TEXTS_ID,
    _type: "texts",
    engineTexts: ENGINE_TEXTS.map(({ key, ...words }) => ({ _key: key.replaceAll(".", "-"), _type: "engineText", key, text: localeText(words) })),
  }
}
