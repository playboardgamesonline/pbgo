import { ageRulesOf } from "@pbgo/catalog/server"
import * as core from "@pbgo/core/routes/api/games/route"
import { gameRoute } from "@pbgo/games"

// The routes that seat somebody or change what a table plays are given the age that the game and its expansions ask (the Studio's "Minimum age", from the catalog): core cannot read the catalog, and a route made without it does not compile (PLT-125)
export const POST = gameRoute(core.postGame(ageRulesOf))
