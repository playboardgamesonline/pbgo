import "server-only"

/**
 * The game for @pbgo/core, server side. Optional exports: `loadSetupData` (data given to `GAME.setup`),
 * `loadGameData` (`data` prop of the board), `ROUTES` (the game's own API routes, under /api/<slug>/games/<code>/<route>).
 */
export * from "./index"
