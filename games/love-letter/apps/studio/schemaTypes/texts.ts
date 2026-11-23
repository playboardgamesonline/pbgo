import { createTexts } from "@pbgo/studio-kit"
import { defineField } from "sanity"

/** A word of the board, one per language. The `title` names the placeholders that the board fills in: `{number}` (the round), `{count}` (the favor tokens that win) and `{target}`, `{player}` and `{winners}` (the names of players) and `{card}` and `{guess}` (the name of a character). */
const word = (name: string, title: string) => defineField({ name, title, type: "localeString", group: "board" })

/**
 * Shared texts (interface labels, victory phrases, error messages, the words of the engine) and the words of Love Letter's board: the round and the tokens that win for the ticker, the announcement that is the game's own, the status of a player, the sentences of the strip in the middle of the table and its pads, and the sentences of the history, one for each event of the log.
 * The names are `WORD_FIELDS` of `src/lib/words.ts`, which `board-words.test.ts` keeps equal to this list.
 */
export const texts = createTexts(
  [
    word("round", "Round ({number})"),
    word("tokensToWin", "Favor tokens that win ({count})"),
    word("start", "Announcement · the game starts"),
    word("out", "Status · out of the round"),
    word("shielded", "Status · protected by a Handmaid"),
    word("roundWinner", "Status · won the round"),
    word("pickCard", "Ticker · choose a card to play"),
    word("mustPlayCountess", "Ticker · the Countess must be played"),
    word("chooseOther", "Ticker · choose another player"),
    word("chooseAny", "Ticker · choose any player (the Prince)"),
    word("nameCharacter", "Ticker · name a character (the Guard)"),
    word("keepOne", "Ticker · keep one card (the Chancellor)"),
    word("putBack", "Ticker · press the card that goes under the deck first (the Chancellor)"),
    word("play", "Card · play, spoken"),
    word("keep", "Card · keep, spoken"),
    word("deal", "Button · deal the next round"),
    word("targetPlayer", "Zone of a player, spoken ({target})"),
    word("eventRound", "History · a round is dealt ({number})"),
    word("eventDraw", "History · a card is drawn"),
    word("eventPlay", "History · a card is played ({card})"),
    word("eventGuessHit", "History · a Guard names a character and hits ({guess}, {target})"),
    word("eventGuessMiss", "History · a Guard names a character and misses ({guess}, {target})"),
    word("eventLook", "History · a Priest looks at a hand ({target})"),
    word("eventCompare", "History · a Baron compares hands ({target})"),
    word("eventSwap", "History · a King trades hands ({target})"),
    word("eventProtect", "History · a Handmaid protects"),
    word("eventDiscard", "History · a Prince makes a player discard ({player}, {card})"),
    word("eventDiscardSelf", "History · a Prince makes its own player discard ({card})"),
    word("eventOutGuard", "History · out, named by a Guard ({player})"),
    word("eventOutBaron", "History · out, the lower card of a Baron ({player})"),
    word("eventOutPrincess", "History · out, the Princess ({player})"),
    word("eventChancellor", "History · a Chancellor draws cards"),
    word("eventBottom", "History · the cards a Chancellor puts back"),
    word("eventFizzled", "History · a card is played with no effect"),
    word("eventReveal", "History · the deck is empty and the hands are shown"),
    word("eventEnd", "History · a round is won ({winners})"),
    word("eventSpy", "History · the Spy's token ({player})"),
    word("eventOver", "History · the game is won ({winners})"),
    word("outOfRound", "Ticker · the viewer is out of the round"),
  ],
  [{ name: "board", title: "Board" }],
)
