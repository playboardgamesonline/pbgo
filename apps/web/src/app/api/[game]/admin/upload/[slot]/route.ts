import * as core from "@pbgo/core/routes/api/admin/upload/[slot]/route"
import { gameRoute } from "@pbgo/games"

export const POST = gameRoute(core.POST)
export const DELETE = gameRoute(core.DELETE)
