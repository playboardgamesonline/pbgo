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
 * The words of the board: the fields of the "Board" tab of `texts` (`WORD_FIELDS` of `src/lib/words.ts`, which a test keeps equal to this list and to the Studio). The `{placeholders}` are filled in by the board: `{target}` is a player, `{card}` a
 * card (its figure, or the name of an action card), `{points}` and `{number}` numbers. Every language has the same ones. The sentences of the history say what a player did and leave out who: the ticker of the HUD shows the player's name as the
 * heading of their turn, so each reads after it ("Alex" then "stays and banks 21"). French follows the glossary of these notes (encore, stop, manche, doublon), English is the base every language falls back to, Spanish and German are written to
 * read: they are for the owner to check in the Studio. No sentence ends on an ellipsis, and none has a gender to agree with (a card may be a figure or the name of an action card).
 */
export const BOARD_WORDS = [
  { key: "hit", fr: "Encore", en: "Hit", es: "Pedir carta", de: "Ziehen" },
  { key: "stay", fr: "Stop", en: "Stay", es: "Plantarse", de: "Halten" },
  { key: "deal", fr: "Distribuer", en: "Deal", es: "Repartir", de: "Geben" },
  {
    key: "targetFreeze",
    fr: "Choisis le joueur qui reçoit ce Gel",
    en: "Choose the player who gets this Freeze",
    es: "Elige al jugador que recibe esta carta Congelar",
    de: "Wähle den Spieler, der dieses Einfrieren bekommt",
  },
  {
    key: "targetFlipThree",
    fr: "Choisis le joueur qui reçoit ce Flip Three",
    en: "Choose the player who gets this Flip Three",
    es: "Elige al jugador que recibe este Flip Three",
    de: "Wähle den Spieler, der dieses Flip Three bekommt",
  },
  {
    key: "targetSecondChance",
    fr: "Choisis le joueur qui reçoit cette Seconde chance",
    en: "Choose the player who gets this Second Chance",
    es: "Elige al jugador que recibe esta Segunda oportunidad",
    de: "Wähle den Spieler, der diese Zweite Chance bekommt",
  },
  { key: "targetPlayer", fr: "Donner à {target}", en: "Give it to {target}", es: "Dárselo a {target}", de: "An {target} geben" },
  { key: "round", fr: "Manche {number}", en: "Round {number}", es: "Ronda {number}", de: "Runde {number}" },
  { key: "firstTo", fr: "Premier à {points}", en: "First to {points}", es: "Primero a {points}", de: "Erster bei {points}" },
  { key: "busted", fr: "Doublon", en: "Bust", es: "Repetida", de: "Doppelt" },
  { key: "frozen", fr: "Gelé", en: "Frozen", es: "Congelado", de: "Eingefroren" },
  { key: "stayed", fr: "Arrêté", en: "Stayed", es: "Plantado", de: "Gehalten" },
  { key: "start", fr: "On retourne !", en: "Let’s flip!", es: "¡A voltear!", de: "Los geht’s!" },
  { key: "flip7", fr: "Flip 7 !", en: "Flip 7!", es: "¡Flip 7!", de: "Flip 7!" },
  { key: "eventRound", fr: "distribue la manche {number}", en: "deals round {number}", es: "reparte la ronda {number}", de: "gibt Runde {number}" },
  { key: "eventDeal", fr: "reçoit {card}", en: "is dealt {card}", es: "recibe {card}", de: "bekommt {card}" },
  { key: "eventHit", fr: "en reprend une et retourne {card}", en: "hits and turns over {card}", es: "pide carta y voltea {card}", de: "zieht und deckt {card} auf" },
  { key: "eventFlip", fr: "retourne {card}", en: "flips {card}", es: "voltea {card}", de: "deckt {card} auf" },
  { key: "eventStay", fr: "s’arrête et met {points} en banque", en: "stays and banks {points}", es: "se planta y guarda {points}", de: "hält und sichert {points}" },
  { key: "eventBust", fr: "fait un doublon avec {card}", en: "busts on {card}", es: "repite {card} y queda fuera", de: "hat {card} doppelt und scheidet aus" },
  {
    key: "eventSaved",
    fr: "annule {card} avec une Seconde chance",
    en: "cancels {card} with a Second Chance",
    es: "anula {card} con una Segunda oportunidad",
    de: "hebt {card} mit einer Zweiten Chance auf",
  },
  { key: "eventPlay", fr: "donne {card} à {target}", en: "gives {card} to {target}", es: "da {card} a {target}", de: "gibt {card} an {target}" },
  { key: "eventKeep", fr: "garde {card}", en: "keeps {card}", es: "se queda con {card}", de: "behält {card}" },
  { key: "eventDiscarded", fr: "défausse {card}", en: "discards {card}", es: "descarta {card}", de: "legt {card} ab" },
  {
    key: "eventReshuffle",
    fr: "mélange la défausse en une nouvelle pioche",
    en: "shuffles the discard into a new deck",
    es: "baraja el descarte en un mazo nuevo",
    de: "mischt den Ablagestapel zu einem neuen Stapel",
  },
  { key: "eventFlip7", fr: "réussit un Flip 7 !", en: "makes a Flip 7!", es: "¡logra un Flip 7!", de: "schafft ein Flip 7!" },
  { key: "eventEnd", fr: "termine la manche", en: "ends the round", es: "termina la ronda", de: "beendet die Runde" },
  { key: "eventOver", fr: "termine la partie", en: "ends the game", es: "termina la partida", de: "beendet das Spiel" },
]

/**
 * The part of the shared `texts` document that the seed fills: the engine's words, the messages of the game's own error codes (one keyed item each, the `_key` the Copy page writes) and the words of the board (one `localeString` each, under the name of
 * its field), so that the seed adds the ones Sanity lacks and keeps the ones edited in the Studio. Everything else of Copy (the interface labels, the victory phrases, the messages of the shared codes, which the platform words) is set in the Studio
 * and left alone.
 */
export function buildTexts(): SeedDoc {
  return {
    _id: TEXTS_ID,
    _type: "texts",
    errorMessages: ERROR_MESSAGES.map(({ code, ...words }) => ({ _key: code, _type: "errorMessage", code, message: localeString(words) })),
    engineTexts: ENGINE_TEXTS.map(({ key, ...words }) => ({ _key: engineTextKey(key), _type: "engineText", key, text: localeText(words) })),
    ...Object.fromEntries(BOARD_WORDS.map(({ key, ...words }) => [key, localeString(words)])),
  }
}
