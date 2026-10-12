import { courtier } from "./documents/courtier"
import { family } from "./documents/family"
import { game } from "./documents/game"
import { mission } from "./documents/mission"
import { role } from "./documents/role"
import { rules } from "./documents/rules"
import { texts } from "./documents/texts"
import { condition } from "./objects/condition"

/** Courtisans' own types; `rules` and `texts` replace the shared versions of @pbgo/studio-kit. */
export const gameTypes = [game, rules, texts, family, role, courtier, mission, condition]
