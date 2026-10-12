import * as core from "@pbgo/core/routes/api/feedback/route"
import { gameRoute } from "@pbgo/games"

export const GET = gameRoute(core.GET)
export const POST = gameRoute(core.POST)
export const PATCH = gameRoute(core.PATCH)
export const DELETE = gameRoute(core.DELETE)
