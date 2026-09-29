import { courtier } from "./documents/courtier"
import { family } from "./documents/family"
import { game } from "./documents/game"
import { interfaceDoc } from "./documents/interface"
import { mission } from "./documents/mission"
import { role } from "./documents/role"
import { rules } from "./documents/rules"
import { texts } from "./documents/texts"
import { condition } from "./objects/condition"
import { localeString, localeStringList, localeText } from "./objects/locale"

export const schemaTypes = [interfaceDoc, game, rules, texts, family, role, courtier, mission, condition, localeString, localeText, localeStringList]
