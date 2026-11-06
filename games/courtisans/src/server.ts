import "server-only"
import type { LoaderContext } from "@pbgo/core/lib/binding"
import { getClientCatalog } from "./sanity/catalog-client"
import { loadMissions } from "./server/missions"

/** Courtisans for @pbgo/core, server side: the shared part and the data loaders. */
export * from "./index"

/** The missions of Sanity, drawn at the start of each game. */
export const loadSetupData = ({ sanity }: LoaderContext) => loadMissions(sanity)

/** Catalog (card images, families, roles, game texts) given to the board. */
export const loadGameData = (ctx: LoaderContext) => getClientCatalog(ctx)
