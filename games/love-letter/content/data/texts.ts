import type { SeedDoc } from "@pbgo/content-kit"

export const TEXTS_ID = "texts"

/** A text with the languages that have a source: Spanish and German are left out, gaps for the Studio, and never a translation the seed cannot source (the board shows the English meanwhile). */
type Said = { fr: string; en: string }

/**
 * The `_key` of an item of `engineTexts`, as the Copy page of the gamemaster writes it (`core/server/settings.ts`: every character outside letters, digits, `_` and `-` becomes `_`). A seed that wrote another one would add each text a second time to a
 * list the Copy page had already saved, since the merge pairs the items by `_key`.
 */
const engineTextKey = (key: string) => key.replace(/[^A-Za-z0-9_-]/g, "_")

/**
 * The words the engine names by key instead of carrying them (docs/engine/01-the-game/07-parameters.md, "The words of options and scores"): the game has no option, so only the lines of the score of a player, listed in `scoreLines` of `GAME`: the
 * rounds played, the rounds won and the Spy's tokens (`score.<line>`). `parity/engine.test.ts` keeps this list equal to what `engineTextKeys` asks of the engine. English is the base every language falls back to, French follows the leaflet's terms
 * (manche, pion): both are written for the platform, for the owner to read. Spanish and German have no source.
 */
export const ENGINE_TEXTS: (Said & { key: string })[] = [
  { key: "score.rounds", fr: "Manches jouées", en: "Rounds played" },
  { key: "score.won", fr: "Manches gagnées", en: "Rounds won" },
  { key: "score.spy", fr: "Pions de l’Espionne", en: "Spy tokens" },
]

/**
 * The messages of the codes the binding lists in `ERROR_CODES` (`src/lib/site.ts`): the refusals only Love Letter can explain, the others being worded by the platform. `parity/engine.test.ts` keeps this list equal to `ERROR_CODES`. A player only meets
 * this one through a screen that is out of date, since the board does not offer the card that the Countess rule forbids (`me.playable`). French has the platform's "vous". Both languages are written for the platform, for the owner to read.
 */
export const ERROR_MESSAGES: (Said & { code: string })[] = [
  {
    code: "MUST_PLAY_COUNTESS",
    fr: "Vous devez jouer la Comtesse quand votre autre carte est le Roi ou un Prince.",
    en: "You must play the Countess when your other card is the King or a Prince.",
  },
]

/**
 * The words of the board: the fields of the "Board" tab of `texts` (`WORD_FIELDS` of `src/lib/words.ts`, which `board-words.test.ts` keeps equal to this list and to the Studio). The `{placeholders}` are filled in by the board: `{number}` is the round and
 * `{count}` the favor tokens that win. English is the base every language falls back to; French follows the leaflet's terms (manche, pion Faveur) and the board speaks to a player as "tu", like the prompts of the other games. Both are written for the platform,
 * for the owner to read; Spanish and German have no source and stay empty.
 */
export const BOARD_WORDS: (Said & { key: string })[] = [
  { key: "round", fr: "Manche {number}", en: "Round {number}" },
  { key: "tokensToWin", fr: "{count} pions Faveur pour gagner", en: "{count} favor tokens to win" },
  { key: "start", fr: "Que la lettre arrive à bon port !", en: "Deliver the letter!" },
  { key: "out", fr: "Hors manche", en: "Out" },
  { key: "shielded", fr: "Protégé", en: "Protected" },
  { key: "roundWinner", fr: "A gagné la manche", en: "Won the round" },
]

/** A `localeString` and a `localeText` of the shared Studio schema with the languages that have a text. The content kit's builders refuse an empty language; here Spanish and German stay empty on purpose, as in the characters. */
const localeStringOf = ({ fr, en }: Said) => ({ _type: "localeString" as const, fr, en })
const localeTextOf = ({ fr, en }: Said) => ({ _type: "localeText" as const, fr, en })

/**
 * The part of the shared `texts` document that the seed fills: the engine's words, the messages of the game's own error codes (one keyed item each, the `_key` the Copy page writes) and the words of the board (one `localeString` each, under the name of its field), so that the seed adds the ones Sanity lacks and keeps the ones
 * edited in the Studio. Everything else of Copy (the interface labels, the messages of the shared codes, which the platform words, the victory phrases) is set in the Studio and left alone.
 */
export function buildTexts(): SeedDoc {
  return {
    _id: TEXTS_ID,
    _type: "texts",
    errorMessages: ERROR_MESSAGES.map(({ code, ...words }) => ({ _key: code, _type: "errorMessage", code, message: localeStringOf(words) })),
    engineTexts: ENGINE_TEXTS.map(({ key, ...words }) => ({ _key: engineTextKey(key), _type: "engineText", key, text: localeTextOf(words) })),
    ...Object.fromEntries(BOARD_WORDS.map(({ key, ...words }) => [key, localeStringOf(words)])),
  }
}
