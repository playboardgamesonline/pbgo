import * as core from "@pbgo/core/routes/gamemaster/tasks/route"
import { gamemasterRoute } from "@pbgo/games"

export const GET = gamemasterRoute(core.GET)
export const POST = gamemasterRoute(core.POST)
