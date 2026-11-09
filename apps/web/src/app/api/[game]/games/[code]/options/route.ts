import { ageRulesOf } from "@pbgo/catalog/server"
import * as core from "@pbgo/core/routes/api/games/[code]/options/route"
import { gameRoute } from "@pbgo/games"

export const POST = gameRoute(core.postOptions(ageRulesOf))
