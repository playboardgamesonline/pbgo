import { defineQuery } from "next-sanity"

export const CATALOG_QUERY = defineQuery(`{
  "game": *[_id == "game"][0]{ mat, matTexture, courtierBack, whiteMissionBack, blueMissionBack, pictogramFrame, arrowUp, arrowDown },
  "rules": *[_id == "rules"][0],
  "texts": *[_id == "texts"][0]{ missionsButton, banquetStarts },
  "families": *[_type == "family"]{ _id, name, key, color, pictogram },
  "roles": *[_type == "role"]{ _id, name, key, countPerFamily, pictogram, rule, "lettering": lettering.asset->url },
  "courtiers": *[_type == "courtier"]{ _id, quantity, card, "family": family->key, "role": role->key },
  "missions": *[_type == "mission"]{ _id, color, text, card, condition }
}`)
