import * as core from "@pbgo/core/routes/gamemaster/feedback/route"
import { gamemasterRoute } from "@pbgo/games"

export const GET = gamemasterRoute(core.GET)
export const PATCH = gamemasterRoute(core.PATCH)
export const DELETE = gamemasterRoute(core.DELETE)
