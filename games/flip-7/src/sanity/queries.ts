import { defineQuery } from "next-sanity"

export const CATALOG_QUERY = defineQuery(`{
  "game": *[_id == "game"][0]{ mat, cardBack },
  "texts": *[_id == "texts"][0]{
    homeHeading, genres,
    hit, stay, deal, round, goal, deck, discard, dealer, stayed, frozen, busted,
    scoreNow, scoreTotal, setAside, targetPrompt, targetOther, dealMine, dealOther,
    evHit, evFlipped, evBust, evSaved, evStay, evGive, evGiveSelf, evDiscarded, evReshuffle, evFlip7,
    detailRounds, detailBestRound, detailFlip7, detailBusts, flip7Banner
  },
  "numberCards": *[_type == "numberCard"]{ key, image },
  "actionCards": *[_type == "actionCard"]{ key, name, image },
  "modifierCards": *[_type == "modifierCard"]{ key, image }
}`)
