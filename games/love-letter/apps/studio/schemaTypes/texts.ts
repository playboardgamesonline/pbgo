import { createTexts } from "@pbgo/studio-kit"
import { defineField } from "sanity"

/** A word of the board, one per language. The `title` names the placeholders that the board fills in: `{number}` (the round), `{count}` (the favor tokens that win) and `{target}` (the name of a player). */
const word = (name: string, title: string) => defineField({ name, title, type: "localeString", group: "board" })

/**
 * Shared texts (interface labels, victory phrases, error messages, the words of the engine) and the words of Love Letter's board: the round and the tokens that win for the ticker, the announcement that is the game's own, the status of a player, the sentences of the strip in the middle of the table and its pads.
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
    word("pickCard", "Strip · choose a card to play"),
    word("mustPlayCountess", "Strip · the Countess must be played"),
    word("chooseOther", "Strip · choose another player"),
    word("chooseAny", "Strip · choose any player (the Prince)"),
    word("nameCharacter", "Strip · name a character (the Guard)"),
    word("noTarget", "Strip · nobody can be chosen"),
    word("keepOne", "Strip · keep one card (the Chancellor)"),
    word("putBack", "Strip · the others go under the deck"),
    word("play", "Pad · play the card"),
    word("keep", "Pad · keep the card"),
    word("deal", "Pad · deal the next round"),
    word("swap", "Pad · swap the two cards put back"),
    word("targetPlayer", "Zone of a player, spoken ({target})"),
  ],
  [{ name: "board", title: "Board" }],
)
