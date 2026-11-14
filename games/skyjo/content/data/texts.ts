import { localeString, localeText } from "@pbgo/content-kit"
import type { SeedDoc } from "@pbgo/content-kit"

export const TEXTS_ID = "texts"

/**
 * The `_key` of an item of `engineTexts`, as the Copy page of the gamemaster writes it (`core/server/settings.ts`: every character outside letters, digits, `_` and `-` becomes `_`). A seed that wrote another one would add each text a second time to a
 * list the Copy page had already saved, since the merge pairs the items by `_key`.
 */
const engineTextKey = (key: string) => key.replace(/[^A-Za-z0-9_-]/g, "_")

/**
 * The words the engine names by key instead of carrying them (docs/engine/01-the-game/07-parameters.md, "The words of options and scores"): the lines of the score of a player. Skyjo has no option. The keys are the engine's (`score.<line>`), and
 * `parity/engine.test.ts` keeps this list equal to what `engineTextKeys` asks of the engine. French is the booklet's language, English is the base every language falls back to, Spanish and German were written by an agent to read: they are for the owner to check in the Studio.
 */
export const ENGINE_TEXTS = [
  { key: "score.rounds", fr: "Manches jouées", en: "Rounds played", es: "Rondas jugadas", de: "Gespielte Runden" },
  { key: "score.bestRound", fr: "Meilleure manche", en: "Best round", es: "Mejor ronda", de: "Beste Runde" },
  { key: "score.columns", fr: "Colonnes défaussées", en: "Columns thrown away", es: "Columnas descartadas", de: "Abgelegte Spalten" },
  { key: "score.ended", fr: "Manches terminées", en: "Rounds ended", es: "Rondas terminadas", de: "Beendete Runden" },
  { key: "score.doubled", fr: "Manches doublées", en: "Rounds doubled", es: "Rondas dobladas", de: "Verdoppelte Runden" },
]

/**
 * The messages of the codes the binding lists in `ERROR_CODES` (`src/lib/site.ts`): the refusals only Skyjo can explain, the others being worded by the platform. `parity/engine.test.ts` keeps this list equal to `ERROR_CODES`. A player only meets them
 * through a screen that is out of date, since the board offers only the cards that can be pressed. French has the platform's "vous", Spanish and German its "tú" and "du"; Spanish and German are written to read, for the owner to check in the Studio.
 */
export const ERROR_MESSAGES = [
  {
    code: "INVALID_POSITION",
    fr: "Ce n’est pas une carte de votre grille.",
    en: "That is not a card of your grid.",
    es: "Esa no es una carta de tu cuadrícula.",
    de: "Das ist keine Karte deines Rasters.",
  },
  {
    code: "CARD_FACE_UP",
    fr: "Cette carte est déjà face visible.",
    en: "That card is already face up.",
    es: "Esa carta ya está boca arriba.",
    de: "Diese Karte liegt schon offen.",
  },
  {
    code: "MUST_PLACE",
    fr: "Une carte prise dans la défausse doit être posée dans votre grille.",
    en: "A card taken from the discard must be placed in your grid.",
    es: "Una carta tomada del descarte debe colocarse en tu cuadrícula.",
    de: "Eine vom Ablagestapel genommene Karte muss in dein Raster gelegt werden.",
  },
]

/**
 * The words of the board: the fields of the "Board" tab of `texts` (`WORD_FIELDS` of `src/lib/words.ts`, which a test keeps equal to this list and to the Studio). The `{placeholders}` are filled in by the board: `{player}` is a nickname, `{card}` and
 * `{replaced}` the figure printed on a card, `{number}`, `{column}`, `{row}`, `{value}` and `{sum}` numbers, `{points}` a count of points. Every language has the same ones. The sentences of the history say what a player did and leave out who: the ticker
 * of the HUD shows the player's name as the heading of their turn, so each reads after it ("Alex" then "draws a card"). French follows the booklet (manche, pioche, défausse, colonne), English is the base every language falls back to, Spanish and German are
 * written to read: they are for the owner to check in the Studio. No sentence ends on an ellipsis.
 */
export const BOARD_WORDS = [
  { key: "draw", fr: "Piocher", en: "Draw", es: "Robar", de: "Ziehen" },
  { key: "takeDiscard", fr: "Prendre la défausse", en: "Take the discard", es: "Tomar el descarte", de: "Ablage nehmen" },
  { key: "throwAway", fr: "Défausser et retourner", en: "Discard and flip", es: "Descartar y voltear", de: "Ablegen und aufdecken" },
  { key: "deal", fr: "Distribuer", en: "Deal", es: "Repartir", de: "Geben" },
  { key: "promptReveal", fr: "Retournez deux de vos cartes", en: "Turn two of your cards over", es: "Voltea dos de tus cartas", de: "Deck zwei deiner Karten auf" },
  {
    key: "promptRevealWait",
    fr: "On attend que tous aient retourné deux cartes",
    en: "Waiting for everyone to turn two cards over",
    es: "Esperando a que todos volteen dos cartas",
    de: "Warten, bis alle zwei Karten aufgedeckt haben",
  },
  {
    key: "promptChoose",
    fr: "Piochez, ou prenez la carte de la défausse",
    en: "Draw a card, or take the discard",
    es: "Roba una carta o toma el descarte",
    de: "Zieh eine Karte oder nimm die Ablage",
  },
  {
    key: "promptPlaceDrawn",
    fr: "Posez-la dans votre grille, ou défaussez-la",
    en: "Place it in your grid, or discard it",
    es: "Colócala en tu cuadrícula o descártala",
    de: "Leg sie in dein Raster oder wirf sie ab",
  },
  {
    key: "promptPlaceTaken",
    fr: "Posez-la dans votre grille",
    en: "Place it in your grid",
    es: "Colócala en tu cuadrícula",
    de: "Leg sie in dein Raster",
  },
  {
    key: "promptFlip",
    fr: "Retournez une de vos cartes cachées",
    en: "Turn one of your hidden cards over",
    es: "Voltea una de tus cartas ocultas",
    de: "Deck eine deiner verdeckten Karten auf",
  },
  { key: "promptWait", fr: "{player} joue", en: "{player} is playing", es: "Juega {player}", de: "{player} ist dran" },
  {
    key: "promptBetween",
    fr: "Manche terminée : {player} distribue la suivante",
    en: "Round over: {player} deals the next one",
    es: "Ronda terminada: {player} reparte la siguiente",
    de: "Runde vorbei: {player} gibt die nächste",
  },
  { key: "promptDeal", fr: "Distribuez la manche suivante", en: "Deal the next round", es: "Reparte la siguiente ronda", de: "Gib die nächste Runde" },
  { key: "cell", fr: "Colonne {column}, ligne {row}", en: "Column {column}, row {row}", es: "Columna {column}, fila {row}", de: "Spalte {column}, Reihe {row}" },
  { key: "lastTurn", fr: "Dernier tour", en: "Last turn", es: "Último turno", de: "Letzter Zug" },
  { key: "ended", fr: "A fini la manche", en: "Ended the round", es: "Terminó la ronda", de: "Hat die Runde beendet" },
  { key: "roundPoints", fr: "{points} sur la manche", en: "{points} this round", es: "{points} en la ronda", de: "{points} in dieser Runde" },
  {
    key: "roundPointsDoubled",
    fr: "{points} sur la manche (×2)",
    en: "{points} (doubled)",
    es: "{points} (doblado)",
    de: "{points} (verdoppelt)",
  },
  { key: "round", fr: "Manche {number}", en: "Round {number}", es: "Ronda {number}", de: "Runde {number}" },
  { key: "endsAt", fr: "Fin à {points} points", en: "Ends at {points}", es: "Termina en {points}", de: "Ende bei {points}" },
  { key: "start", fr: "C’est parti !", en: "Let’s play!", es: "¡A jugar!", de: "Los geht’s!" },
  { key: "lastTurnAnnouncement", fr: "Dernier tour !", en: "Last turn!", es: "¡Último turno!", de: "Letzter Zug!" },
  { key: "eventRound", fr: "distribue la manche {number}", en: "deals round {number}", es: "reparte la ronda {number}", de: "gibt Runde {number}" },
  { key: "eventReveal", fr: "retourne {card}", en: "turns {card} over", es: "voltea {card}", de: "deckt {card} auf" },
  { key: "eventTake", fr: "prend {card} dans la défausse", en: "takes {card} from the discard", es: "toma {card} del descarte", de: "nimmt {card} von der Ablage" },
  { key: "eventDraw", fr: "pioche une carte", en: "draws a card", es: "roba una carta", de: "zieht eine Karte" },
  { key: "eventDrawSeen", fr: "pioche {card}", en: "draws {card}", es: "roba {card}", de: "zieht {card}" },
  {
    key: "eventPlace",
    fr: "pose {card} à la place de {replaced}",
    en: "puts {card} in place of {replaced}",
    es: "pone {card} en lugar de {replaced}",
    de: "legt {card} anstelle von {replaced} ab",
  },
  { key: "eventThrow", fr: "défausse {card}", en: "discards {card}", es: "descarta {card}", de: "wirft {card} ab" },
  { key: "eventFlip", fr: "retourne {card}", en: "turns {card} over", es: "voltea {card}", de: "deckt {card} auf" },
  {
    key: "eventColumn",
    fr: "défausse une colonne de trois {value}",
    en: "throws away a column of three {value}s",
    es: "descarta una columna de tres {value}",
    de: "legt eine Spalte aus drei {value} ab",
  },
  { key: "eventStart", fr: "commence la manche ({sum})", en: "begins the round ({sum})", es: "empieza la ronda ({sum})", de: "beginnt die Runde ({sum})" },
  {
    key: "eventLast",
    fr: "a retourné toutes ses cartes : dernier tour pour les autres",
    en: "turned every card over: one last turn for the others",
    es: "volteó todas sus cartas: último turno para los demás",
    de: "hat alle Karten aufgedeckt: letzter Zug für die anderen",
  },
  {
    key: "eventReshuffle",
    fr: "mélange la défausse en une nouvelle pioche",
    en: "shuffles the discard into a new pile",
    es: "baraja el descarte en un mazo nuevo",
    de: "mischt die Ablage zu einem neuen Stapel",
  },
  { key: "eventEnd", fr: "la manche est comptée", en: "the round is counted", es: "se cuenta la ronda", de: "die Runde wird gezählt" },
  {
    key: "eventEndDoubled",
    fr: "la manche est comptée, les points de celui qui l’a terminée sont doublés",
    en: "the round is counted, and the points of the player who ended it are doubled",
    es: "se cuenta la ronda y los puntos de quien la terminó se doblan",
    de: "die Runde wird gezählt, die Punkte dessen, der sie beendet hat, werden verdoppelt",
  },
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
