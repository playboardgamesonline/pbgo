import * as core from "@pbgo/core/routes/api/games/[code]/[route]/route"
import { gameRoute } from "@pbgo/games"

export const GET = gameRoute(core.GET)
export const POST = gameRoute(core.POST)
