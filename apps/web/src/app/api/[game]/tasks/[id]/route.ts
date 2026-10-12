import * as core from "@pbgo/core/routes/api/tasks/[id]/route"
import { gameRoute } from "@pbgo/games"

export const PATCH = gameRoute(core.PATCH)
export const DELETE = gameRoute(core.DELETE)
