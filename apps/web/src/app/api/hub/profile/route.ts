import { checkCatalogSlugs } from "@pbgo/catalog/server"
import * as core from "@pbgo/core/routes/api/hub/profile/route"

// A member's own handle and the change of what their profile says (PLT-39): they read the visitor's session and the database, so never static. The favourite games are checked against the hub's catalog, which core cannot read
export const dynamic = "force-dynamic"

export const GET = core.GET
export const POST = core.postProfile(checkCatalogSlugs)
