import "server-only"
import type { LoaderContext, ServerBinding } from "@pbgo/core/lib/binding"
import { only } from "@pbgo/core/lib/i18n"
import { getCatalog } from "./sanity/catalog"
import { getClientCatalog } from "./sanity/catalog-client"

/** Flip 7 for @pbgo/core, server side: the shared part and the data loaders. */
export * from "./index"

/** Catalog (card pictures, table, words of the board) given to the board. */
export const loadGameData = (ctx: LoaderContext) => getClientCatalog(ctx)

/** Genres of the home page's JSON-LD and the sentence of its hidden heading: both are written in Sanity (`texts`), a game with neither has neither. */
export const SEO: ServerBinding["SEO"] = async ({ locale, sanity }) => {
  if (!sanity) return {}
  try {
    const { texts } = await getCatalog(sanity)
    return { genres: only(texts?.genres, locale), heading: only(texts?.homeHeading, locale)?.trim() }
  } catch (error) {
    console.error("Sanity catalog unavailable", error)
    return {}
  }
}
