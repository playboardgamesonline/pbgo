import { createTexts } from "@pbgo/studio-kit"
import { defineField } from "sanity"

/** A word of the board, one per language. The `title` names the placeholders that the board fills in: `{target}` (a player), `{card}`, `{points}` and `{number}`. */
const word = (name: string, title: string) => defineField({ name, title, type: "localeString", group: "board" })

/**
 * Shared texts (interface labels, victory phrases, error messages, the words of the engine) and the words of Flip 7's board: its buttons, the status of a player, the two announcements that are the game's own and the sentences of the history.
 * A sentence of the history says what a player did and leaves out who: the ticker shows the player's name as the heading of their turn. The names are `WORD_FIELDS` of `src/lib/words.ts`, which `board-words.test.ts` keeps equal to this list.
 */
export const texts = createTexts(
  [
    word("hit", "Button · hit (turn the next card over)"),
    word("stay", "Button · stay (bank the line)"),
    word("deal", "Button · deal the next round"),
    word("targetFreeze", "Prompt · choose who gets the Freeze"),
    word("targetFlipThree", "Prompt · choose who gets the Flip Three"),
    word("targetSecondChance", "Prompt · choose who gets the Second Chance"),
    word("targetPlayer", "Spoken name of a player's zone, pressed to give them the card ({target})"),
    word("round", "Round ({number})"),
    word("firstTo", "Target score ({points})"),
    word("busted", "Status · bust"),
    word("frozen", "Status · frozen"),
    word("stayed", "Status · stayed"),
    word("start", "Announcement · the game starts"),
    word("flip7", "Announcement · a Flip 7"),
    word("eventRound", "History · deals a round ({number})"),
    word("eventDeal", "History · is dealt a card ({card})"),
    word("eventHit", "History · hits ({card})"),
    word("eventFlip", "History · flips a card for a Flip Three ({card})"),
    word("eventStay", "History · stays ({points})"),
    word("eventBust", "History · busts ({card})"),
    word("eventSaved", "History · a Second Chance saves the player ({card})"),
    word("eventPlay", "History · gives an action card ({card}, {target})"),
    word("eventKeep", "History · keeps a Second Chance ({card})"),
    word("eventDiscarded", "History · discards a card nobody can get ({card})"),
    word("eventReshuffle", "History · shuffles the discard into a new deck"),
    word("eventFlip7", "History · makes a Flip 7"),
    word("eventEnd", "History · ends the round"),
    word("eventOver", "History · ends the game"),
  ],
  [{ name: "board", title: "Board" }],
)
