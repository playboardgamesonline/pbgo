import { createTexts } from "@pbgo/studio-kit"
import { defineField } from "sanity"

/** A word of the board, one per language. The `title` names the placeholders that the board fills in: `{player}`, `{card}`, `{replaced}`, `{number}`, `{column}`, `{row}`, `{value}`, `{sum}` and `{points}`. */
const word = (name: string, title: string) => defineField({ name, title, type: "localeString", group: "board" })

/**
 * Shared texts (interface labels, victory phrases, error messages, the words of the engine) and the words of Skyjo's board: its floor buttons, the instruction written on the table, what a seat says, the announcements that are the game's own and the
 * sentences of the history. A sentence of the history says what a player did and leaves out who: the ticker shows the player's name as the heading of their turn. The names are `WORD_FIELDS` of `src/lib/words.ts`, which `board-words.test.ts` keeps equal to this list.
 */
export const texts = createTexts(
  [
    word("draw", "Button · draw the top card of the pile"),
    word("takeDiscard", "Button · take the top card of the discard"),
    word("throwAway", "Button · throw the drawn card away and turn a card over"),
    word("deal", "Button · deal the next round"),
    word("promptReveal", "Prompt · turn two of your cards over"),
    word("promptRevealWait", "Prompt · waiting for the other players to turn two cards over"),
    word("promptChoose", "Prompt · draw from the pile or take the discard"),
    word("promptPlaceDrawn", "Prompt · place the drawn card in your grid or throw it away"),
    word("promptPlaceTaken", "Prompt · place the card taken from the discard in your grid"),
    word("promptFlip", "Prompt · turn one of your face-down cards over"),
    word("promptWait", "Prompt · another player is playing ({player})"),
    word("promptBetween", "Prompt · the round is over, a player deals the next one ({player})"),
    word("promptDeal", "Prompt · you deal the next round"),
    word("cell", "Spoken name of a card of your grid, pressed to use it ({column}, {row})"),
    word("lastTurn", "Status · plays a last turn"),
    word("ended", "Status · turned every card over and ended the round"),
    word("roundPoints", "Status · points of the round ({points})"),
    word("roundPointsDoubled", "Status · points of the round, doubled ({points})"),
    word("round", "Round ({number})"),
    word("endsAt", "Score that ends the game ({points})"),
    word("start", "Announcement · the game starts"),
    word("lastTurnAnnouncement", "Announcement · last turn"),
    word("eventRound", "History · deals a round ({number})"),
    word("eventReveal", "History · turns a card over ({card})"),
    word("eventTake", "History · takes the top of the discard ({card})"),
    word("eventDraw", "History · draws a card"),
    word("eventDrawSeen", "History · draws a card, as the player who drew it reads it ({card})"),
    word("eventPlace", "History · puts a card in place of another ({card}, {replaced})"),
    word("eventThrow", "History · throws the drawn card away ({card})"),
    word("eventFlip", "History · turns a card over after throwing the drawn card away ({card})"),
    word("eventColumn", "History · throws a column of three equal cards away ({value})"),
    word("eventStart", "History · begins the round ({sum})"),
    word("eventLast", "History · turned every card over: the others play one last turn"),
    word("eventReshuffle", "History · shuffles the discard into a new pile"),
    word("eventEnd", "History · the round is counted"),
    word("eventEndDoubled", "History · the round is counted and the points of the player who ended it are doubled"),
    word("eventOver", "History · ends the game"),
  ],
  [{ name: "board", title: "Board" }],
)
