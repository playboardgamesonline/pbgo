import "server-only"
import { GAME } from "@courtisans/engine"
import type { LoaderContext, ServerBinding } from "@pbgo/core/lib/binding"
import { gameDict } from "./lib/i18n"
import { getClientCatalog } from "./sanity/catalog-client"
import { loadMissions } from "./server/missions"

/** Courtisans for @pbgo/core, server side: the shared part and the data loaders. */
export * from "./index"

/** Missions (Sanity, completed by the default ones) drawn at the start of each game. */
export const loadSetupData = ({ sanity }: LoaderContext) => loadMissions(sanity, GAME.maxPlayers)

/** Catalog (card images, families, roles, game texts) given to the board. */
export const loadGameData = (ctx: LoaderContext) => getClientCatalog(ctx)

/** Genres and platform of the home page's JSON-LD, sentence of its hidden heading. */
export const SEO: ServerBinding["SEO"] = (locale) => {
  const dict = gameDict(locale)
  return { genres: dict.seo.genres, platform: dict.seo.platform, heading: dict.homeHeading }
}
