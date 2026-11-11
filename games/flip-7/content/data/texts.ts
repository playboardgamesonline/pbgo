import { localeString, localeText } from "@pbgo/content-kit"
import type { SeedDoc } from "@pbgo/content-kit"

export const TEXTS_ID = "texts"

/**
 * The `_key` of an item of `engineTexts`, as the Copy page of the gamemaster writes it (`core/server/settings.ts`: every character outside letters, digits, `_` and `-` becomes `_`). A seed that wrote another one would add each text a second time to a
 * list the Copy page had already saved, since the merge pairs the items by `_key`.
 */
const engineTextKey = (key: string) => key.replace(/[^A-Za-z0-9_-]/g, "_")

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
 * The messages of the codes the binding lists in `ERROR_CODES` (`src/lib/site.ts`): the refusals only Flip 7 can explain, the others being worded by the platform. `parity/engine.test.ts` keeps this list equal to `ERROR_CODES`. A player only
 * meets this one through a screen that is out of date, since the board does not offer a stay that the view says is impossible (`canStay`). French has the platform's "vous", Spanish and German its "tú" and "du"; Spanish and German are written to
 * read, for the owner to check in the Studio.
 */
export const ERROR_MESSAGES = [
  {
    code: "CANNOT_STAY",
    fr: "Vous ne pouvez pas vous arrêter tant que vous n’avez aucune carte devant vous : piochez d’abord.",
    en: "You can’t stay with nothing in front of you: hit first.",
    es: "No puedes plantarte sin ninguna carta delante: roba una primero.",
    de: "Du kannst nicht aufhören, solange keine Karte vor dir liegt: zieh zuerst eine.",
  },
]

/**
 * The part of the shared `texts` document that the seed fills: the engine's words and the messages of the game's own error codes, one keyed item each (the `_key` the Copy page writes), so that the seed adds the ones Sanity lacks and keeps the ones
 * edited in the Studio. Everything else of Copy (the interface labels, the victory phrases, the messages of the shared codes, which the platform words) is set in the Studio and left alone.
 */
export function buildTexts(): SeedDoc {
  return {
    _id: TEXTS_ID,
    _type: "texts",
    errorMessages: ERROR_MESSAGES.map(({ code, ...words }) => ({ _key: code, _type: "errorMessage", code, message: localeString(words) })),
    engineTexts: ENGINE_TEXTS.map(({ key, ...words }) => ({ _key: engineTextKey(key), _type: "engineText", key, text: localeText(words) })),
  }
}
