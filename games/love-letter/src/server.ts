import "server-only"
import type { LoaderContext } from "@pbgo/core/lib/binding"
import { getClientCatalog } from "./sanity/catalog-client"

/** The game for @pbgo/core, server side: the shared part and the data loader. */
export * from "./index"

/** The catalog given to the board: the face, the name and the card text of each character, the back of the cards and the words of the board, from the game's Sanity project. */
export const loadGameData = (ctx: LoaderContext) => getClientCatalog(ctx)
