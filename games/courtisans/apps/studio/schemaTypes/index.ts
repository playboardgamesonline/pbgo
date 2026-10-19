import { courtier } from "./documents/courtier"
import { family } from "./documents/family"
import { game } from "./documents/game"
import { mission } from "./documents/mission"
import { role } from "./documents/role"
import { texts } from "./documents/texts"
import { condition } from "./objects/condition"

/** Courtisans' own types; `texts` replaces the shared version of @pbgo/studio-kit. */
export const gameTypes = [game, texts, family, role, courtier, mission, condition]
