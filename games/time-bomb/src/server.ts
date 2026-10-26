import "server-only"
import type { ServerBinding } from "@pbgo/core/lib/binding"
import { GENRES } from "./lib/site"

/** The game for @pbgo/core, server side. */
export * from "./index"

/** Genres of the home page's structured data. */
export const SEO: ServerBinding["SEO"] = () => ({ genres: GENRES })
