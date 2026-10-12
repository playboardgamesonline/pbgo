import type { GameRouteContext, GameRouteHandler } from "../../../../../lib/binding"

/** The game's own routes (`ROUTES` of its server binding, e.g. Courtisans `banquet`), served at `/api/<slug>/games/<code>/<route>`. */
function dispatch(method: "GET" | "POST"): GameRouteHandler {
  return async (request: Request, ctx: GameRouteContext) => {
    const routes = ctx.game.binding.ROUTES ?? {}
    const name = ctx.params.route ?? ""
    const handler = Object.hasOwn(routes, name) ? routes[name]?.[method] : undefined
    if (!handler) return Response.json({ error: "NOT_FOUND" }, { status: 404 })
    return handler(request, ctx)
  }
}

export const GET = dispatch("GET")
export const POST = dispatch("POST")
