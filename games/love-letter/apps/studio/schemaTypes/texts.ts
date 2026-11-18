import { createTexts } from "@pbgo/studio-kit"
import { defineField } from "sanity"

/** A word of the board, one per language. The `title` names the placeholders that the board fills in: `{number}` (the round) and `{count}` (the favor tokens that win). */
const word = (name: string, title: string) => defineField({ name, title, type: "localeString", group: "board" })

/**
 * Shared texts (interface labels, victory phrases, error messages, the words of the engine) and the words of Love Letter's board: the round and the tokens that win for the ticker, the announcement that is the game's own and the status of a player.
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
  ],
  [{ name: "board", title: "Board" }],
)
