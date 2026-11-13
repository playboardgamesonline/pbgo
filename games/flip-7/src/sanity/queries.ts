import { defineQuery } from "next-sanity"

/** What the board reads from the game's Sanity project: the pictures of the cards and of their back, the name of each action card, and the words of the "Board" tab of `texts` (`WORD_FIELDS`). */
export const CATALOG_QUERY = defineQuery(`{
  "game": *[_id == "game"][0]{ cardBack },
  "texts": *[_id == "texts"][0]{
    hit, stay, deal, targetFreeze, targetFlipThree, targetSecondChance, targetPlayer, round, firstTo, busted, frozen, stayed, start, flip7,
    eventRound, eventDeal, eventHit, eventFlip, eventStay, eventBust, eventSaved, eventPlay, eventKeep,
    eventDiscarded, eventReshuffle, eventFlip7, eventEnd, eventOver
  },
  "numbers": *[_type == "numberCard"]{ key, image },
  "actions": *[_type == "actionCard"]{ key, name, image },
  "modifiers": *[_type == "modifierCard"]{ key, image }
}`)
