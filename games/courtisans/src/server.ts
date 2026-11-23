import "server-only"
import type { LoaderContext } from "@pbgo/core/lib/binding"
import { getClientCatalog } from "./sanity/catalog-client"

/** Courtisans for @pbgo/core, server side: the shared part and the data loaders. */
export * from "./index"

/** Catalog (card images, families, roles, game texts) given to the board. */
export const loadGameData = (ctx: LoaderContext) => getClientCatalog(ctx)
