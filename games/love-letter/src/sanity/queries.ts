import { defineQuery } from "next-sanity"

/** What the board reads from the game's Sanity project: the ten characters (their face, their name and their card text), the back of the cards, and the words of the "Board" tab of `texts` (`WORD_FIELDS`). */
export const CATALOG_QUERY = defineQuery(`{
  "game": *[_id == "game"][0]{ cardBack },
  "texts": *[_id == "texts"][0]{ round, tokensToWin, start, out, shielded, roundWinner, pickCard, mustPlayCountess, chooseOther, chooseAny, nameCharacter, noTarget, keepOne, putBack, play, keep, deal, swap, targetPlayer, eventRound, eventDraw, eventPlay, eventGuessHit, eventGuessMiss, eventLook, eventCompare, eventSwap, eventProtect, eventDiscard, eventDiscardSelf, eventOutGuard, eventOutBaron, eventOutPrincess, eventChancellor, eventBottom, eventFizzled, eventReveal, eventEnd, eventSpy, eventOver },
  "characters": *[_type == "character"]{ key, name, text, image }
}`)
