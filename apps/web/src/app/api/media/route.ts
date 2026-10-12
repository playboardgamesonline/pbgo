import { mediaRoute } from "@pbgo/core/routes/api/media/route"
import { GAMES } from "@pbgo/games/registry"

// Only the assets of the games' own Sanity projects are proxied
export const GET = mediaRoute(GAMES.map((game) => game.sanityProjectId))
