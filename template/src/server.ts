import "server-only"
import type { ServerBinding } from "@pbgo/core/lib/binding"
import { GENRES } from "./lib/site"

/**
 * The game for @pbgo/core, server side. Optional exports: `loadSetupData` (data given to `GAME.setup`),
 * `loadGameData` (`data` prop of the board), `ROUTES` (the game's own API routes, under /api/<slug>/games/<code>/<route>).
 */
export * from "./index"

/** Genres of the home page's structured data. */
export const SEO: ServerBinding["SEO"] = () => ({ genres: GENRES })
