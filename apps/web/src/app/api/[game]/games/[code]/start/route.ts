import { ageRulesOf } from "@pbgo/catalog/server"
import * as core from "@pbgo/core/routes/api/games/[code]/start/route"
import { gameRoute } from "@pbgo/games"

export const POST = gameRoute(core.postStart(ageRulesOf))
