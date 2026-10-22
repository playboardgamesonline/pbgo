import { createTexts } from "@pbgo/studio-kit"
import { defineField } from "sanity"

/** A text of the board, one per language. `title` carries the placeholders the code fills in (`{name}`, `{card}`). */
const word = (name: string, title: string) => defineField({ name, title, type: "localeString", group: "board" })

/** Shared texts (interface labels, victory sentences, error messages…) + the vocabulary of Flip 7's board. */
export const texts = createTexts(
  [
    defineField({ name: "homeHeading", title: "Home heading (hidden, for search engines)", type: "localeString", group: "content" }),
    defineField({ name: "genres", title: "Genres (search engines)", type: "localeStringList", group: "content" }),
    word("hit", "Button · hit (draw a card)"),
    word("stay", "Button · stay (bank the round)"),
    word("deal", "Button · deal the next round"),
    word("round", "Round {round} (info line, history, announcement)"),
    word("goal", "Goal · points to win ({score})"),
    word("deck", "Draw pile"),
    word("discard", "Discard pile"),
    word("dealer", "Dealer"),
    word("stayed", "Status · stayed"),
    word("frozen", "Status · frozen"),
    word("busted", "Status · bust"),
    word("scoreNow", "Score · this round"),
    word("scoreTotal", "Score · total"),
    word("setAside", "Cards set aside (a Freeze or Flip Three flipped during a Flip Three)"),
    word("targetPrompt", "Target · who gets the card ({card})"),
    word("targetOther", "Target · another player is choosing ({name}, {card})"),
    word("dealMine", "Between rounds · you deal the next round"),
    word("dealOther", "Between rounds · another player deals the next round ({name})"),
    word("evHit", "History · draws a card ({card})"),
    word("evFlipped", "History · flips a card during a Flip Three ({card})"),
    word("evBust", "History · bust on a duplicate ({card})"),
    word("evSaved", "History · a Second Chance cancels a duplicate ({second}, {card})"),
    word("evStay", "History · stays ({points})"),
    word("evGive", "History · gives an action card ({card}, {target})"),
    word("evGiveSelf", "History · keeps an action card or gives it to themselves ({card})"),
    word("evDiscarded", "History · nobody can get the action card ({card})"),
    word("evReshuffle", "History · the discard pile is shuffled back into the draw pile"),
    word("evFlip7", "History · seven different numbers, the round is over"),
    word("detailRounds", "Game over · rounds played"),
    word("detailBestRound", "Game over · best round"),
    word("detailFlip7", "Game over · Flip 7 made"),
    word("detailBusts", "Game over · rounds lost to a bust"),
    word("flip7Banner", "Announcement · Flip 7"),
  ],
  [{ name: "board", title: "Board" }],
)
