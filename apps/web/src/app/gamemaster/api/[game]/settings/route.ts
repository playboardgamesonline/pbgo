import * as core from "@pbgo/core/routes/gamemaster/settings/route"
import { gamemasterRoute } from "@pbgo/games"

export const GET = gamemasterRoute(core.GET)
export const PUT = gamemasterRoute(core.PUT)
