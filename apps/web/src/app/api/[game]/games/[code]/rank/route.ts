import * as core from "@pbgo/core/routes/api/games/[code]/rank/route"
import { gameRoute } from "@pbgo/games"

export const GET = gameRoute(core.GET)
