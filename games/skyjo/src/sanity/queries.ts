import { defineQuery } from "next-sanity"

/** What the board reads from the game's Sanity project: the pictures of the cards and of their back, and the words of the "Board" tab of `texts` (`WORD_FIELDS`). */
export const CATALOG_QUERY = defineQuery(`{
  "game": *[_id == "game"][0]{ cardBack },
  "texts": *[_id == "texts"][0]{
    draw, takeDiscard, throwAway, deal,
    promptReveal, promptRevealWait, promptChoose, promptPlaceDrawn, promptPlaceTaken, promptFlip, promptWait, promptBetween, promptDeal,
    cell, lastTurn, ended, roundPoints, roundPointsDoubled, round, endsAt, start, lastTurnAnnouncement,
    eventRound, eventReveal, eventTake, eventDraw, eventDrawSeen, eventPlace, eventThrow, eventFlip, eventColumn, eventStart, eventLast,
    eventReshuffle, eventEnd, eventEndDoubled, eventOver
  },
  "cards": *[_type == "card"]{ key, image }
}`)
