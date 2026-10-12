import * as core from "@pbgo/core/routes/gamemaster/upload/[slot]/route"
import { gamemasterRoute } from "@pbgo/games"

export const POST = gamemasterRoute(core.POST)
export const DELETE = gamemasterRoute(core.DELETE)
