import * as core from "@pbgo/core/routes/api/games/[code]/join/route"
import { gameRoute } from "@pbgo/games"

export const POST = gameRoute(core.POST)
