import * as core from "@pbgo/core/routes/api/admin/settings/route"
import { gameRoute } from "@pbgo/games"

export const GET = gameRoute(core.GET)
export const PUT = gameRoute(core.PUT)
export const POST = gameRoute(core.POST)
