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
 * The words of the board: the fields of the "Board" tab of `texts` (`WORD_FIELDS` of `src/lib/words.ts`, which `board-words.test.ts` keeps equal to this list and to the Studio). The `{placeholders}` are filled in by the board: `{number}` is the round,
 * `{count}` the favor tokens that win, `{target}`, `{player}` and `{winners}` the names of players, and `{card}` and `{guess}` the name of a character. English is the base every language falls back to; French follows the leaflet's terms (manche, pion Faveur) and the board speaks to a player as "tu", like the prompts of the other games. Both are written for the platform,
 * for the owner to read; Spanish and German have no source and stay empty.
 */
export const BOARD_WORDS: (Said & { key: string })[] = [
  { key: "round", fr: "Manche {number}", en: "Round {number}" },
  { key: "tokensToWin", fr: "{count} pions Faveur pour gagner", en: "{count} favor tokens to win" },
  { key: "start", fr: "Que la lettre arrive à bon port !", en: "Deliver the letter!" },
  { key: "out", fr: "Hors manche", en: "Out" },
  { key: "shielded", fr: "Protégé", en: "Protected" },
  { key: "roundWinner", fr: "A gagné la manche", en: "Won the round" },
  { key: "pickCard", fr: "Choisis une carte à jouer", en: "Choose a card to play" },
  { key: "mustPlayCountess", fr: "Tu dois jouer la Comtesse", en: "You must play the Countess" },
  { key: "chooseOther", fr: "Choisis un autre joueur", en: "Choose another player" },
  { key: "chooseAny", fr: "Choisis un joueur, toi compris", en: "Choose a player, yourself included" },
  { key: "nameCharacter", fr: "Nomme un personnage", en: "Name a character" },
  { key: "keepOne", fr: "Garde une carte", en: "Keep one card" },
  { key: "putBack", fr: "Touche la carte qui passe sous la pioche en premier", en: "Press the card that goes under the deck first" },
  { key: "play", fr: "Jouer", en: "Play" },
  { key: "keep", fr: "Garder", en: "Keep" },
  { key: "deal", fr: "Distribuer", en: "Deal" },
  { key: "targetPlayer", fr: "Choisir {target}", en: "Choose {target}" },
  { key: "eventRound", fr: "Distribue la manche {number}", en: "Deals round {number}" },
  { key: "eventDraw", fr: "Pioche une carte", en: "Draws a card" },
  { key: "eventPlay", fr: "Joue {card}", en: "Plays {card}" },
  { key: "eventGuessHit", fr: "Nomme {guess} : {target} le détient", en: "Names {guess}: {target} holds it" },
  { key: "eventGuessMiss", fr: "Nomme {guess} : {target} ne l’a pas", en: "Names {guess}: {target} does not" },
  { key: "eventLook", fr: "Regarde la main de {target}", en: "Looks at the hand of {target}" },
  { key: "eventCompare", fr: "Compare sa main à celle de {target}", en: "Compares hands with {target}" },
  { key: "eventSwap", fr: "Échange sa main avec {target}", en: "Trades hands with {target}" },
  { key: "eventProtect", fr: "Est protégé jusqu’à son prochain tour", en: "Is protected until their next turn" },
  { key: "eventDiscard", fr: "Fait défausser {card} à {player}", en: "Makes {player} discard {card}" },
  { key: "eventDiscardSelf", fr: "Défausse {card}", en: "Discards {card}" },
  { key: "eventOutGuard", fr: "{player} quitte la manche : nommé par le Garde", en: "{player} is out: named by the Guard" },
  { key: "eventOutBaron", fr: "{player} quitte la manche : carte la plus faible", en: "{player} is out: the lower card" },
  { key: "eventOutPrincess", fr: "{player} quitte la manche : la Princesse", en: "{player} is out: the Princess" },
  { key: "eventChancellor", fr: "Pioche des cartes pour le Chancelier", en: "Draws cards for the Chancellor" },
  { key: "eventBottom", fr: "Glisse les autres sous la pioche", en: "Puts the others under the deck" },
  { key: "eventFizzled", fr: "Joue sans effet", en: "Plays with no effect" },
  { key: "eventReveal", fr: "La pioche est vide : les mains sont dévoilées", en: "The deck is empty: the hands are shown" },
  { key: "eventEnd", fr: "Manche gagnée par {winners}", en: "Round won by {winners}" },
  { key: "eventSpy", fr: "{player} gagne le pion de l’Espionne", en: "{player} earns the Spy’s token" },
  { key: "eventOver", fr: "Partie gagnée par {winners}", en: "Game won by {winners}" },
  { key: "outOfRound", fr: "Tu as quitté la manche", en: "You are out of the round" },
]

/**
 * The sentence that crowns the winner of a table: the shared `victoryPhrases` of `texts` (a `localeStringList`, which the end screen picks from, so a list of one is that phrase every time). The end screen reads only what comes BEFORE `{pseudo}` (the winner goes in a line of their own under it,
 * with their favor tokens), so the phrase ends with `{pseudo}` and the words before it lead into the name: "The Princess reads the letter of", then "Ada · 4 tokens". One phrase for each language, in the voice of the game (the letters, the court, the Princess). English and French are written for the game, for
 * the owner to read; Spanish and German have no source and stay empty.
 */
export const VICTORY_PHRASES = {
  fr: ["La princesse lit la lettre de {pseudo}"],
  en: ["The Princess reads the letter of {pseudo}"],
}

/**
 * The score of a player is their favor tokens: the label the scoreboard, the share image and the announcement of the end write it with (`pointsShort` of the shared interface labels, `ui_game`) says tokens and not points. `{points}` is their score.
 */
export const POINTS_SHORT: Said = { fr: "{points} pions", en: "{points} tokens" }

/** A `localeString` and a `localeText` of the shared Studio schema with the languages that have a text. The content kit's builders refuse an empty language; here Spanish and German stay empty on purpose, as in the characters. */
const localeStringOf = ({ fr, en }: Said) => ({ _type: "localeString" as const, fr, en })
const localeTextOf = ({ fr, en }: Said) => ({ _type: "localeText" as const, fr, en })

/**
 * The part of the shared `texts` document that the seed fills: the engine's words, the messages of the game's own error codes (one keyed item each, the `_key` the Copy page writes), the words of the board (one `localeString` each, under the name of its field), the victory phrases
 * and the one interface label that says the score is tokens, so that the seed adds the ones Sanity lacks and keeps the ones edited in the Studio. Everything else of Copy (the other interface labels, the messages of the shared codes, which the platform words) is set in the Studio and left alone.
 */
export function buildTexts(): SeedDoc {
  return {
    _id: TEXTS_ID,
    _type: "texts",
    victoryPhrases: { _type: "localeStringList", fr: [...VICTORY_PHRASES.fr], en: [...VICTORY_PHRASES.en] },
    ui_game: { pointsShort: localeStringOf(POINTS_SHORT) },
    errorMessages: ERROR_MESSAGES.map(({ code, ...words }) => ({ _key: code, _type: "errorMessage", code, message: localeStringOf(words) })),
    engineTexts: ENGINE_TEXTS.map(({ key, ...words }) => ({ _key: engineTextKey(key), _type: "engineText", key, text: localeTextOf(words) })),
    ...Object.fromEntries(BOARD_WORDS.map(({ key, ...words }) => [key, localeStringOf(words)])),
  }
}
