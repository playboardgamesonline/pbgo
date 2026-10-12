import * as core from "@pbgo/core/routes/gamemaster/tasks/[id]/route"
import { gamemasterRoute } from "@pbgo/games"

export const PATCH = gamemasterRoute(core.PATCH)
export const DELETE = gamemasterRoute(core.DELETE)
