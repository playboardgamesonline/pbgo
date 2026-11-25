import type { GamemasterRouteContext } from "../../../lib/binding"
import { hasEngine } from "../../../lib/binding"
import type { SandboxAnswer, SandboxRequest } from "../../../lib/sandbox"
import { loadSettings } from "../../../lib/settings-server"
import { ApiError, handle, readJson } from "../../../server/api"
import { loadSetupData } from "../../../server/games"
import { rateLimit } from "../../../server/rate-limit"
import { sandboxAction, sandboxAllowed, sandboxDebug, sandboxLoad, sandboxNew, sandboxPlayFor, sandboxTableOf, sandboxTick, sandboxView } from "../../../server/sandbox"

/**
 * `POST /gamemaster/api/<slug>/sandbox`: the made-up table of the preview of a game in play (`lib/sandbox.ts`). The browser sends the table whole with what it asks (`SandboxRequest`), the engine plays it, and the answer is the table that
 * follows and how the seat looked at sees it. Nothing is read from or written to the database. Under `/gamemaster`, so that the session reaches it on the production deployment, where it is the gamemaster's only (`sandboxAllowed`).
 */
export const POST = handle(async (request: Request, { game }: GamemasterRouteContext): Promise<SandboxAnswer> => {
  await rateLimit(game.slug, request, "sandbox")
  if (!hasEngine(game) || !(await sandboxAllowed())) throw new ApiError("GAME_NOT_FOUND", 404)
  const body = await readJson<SandboxRequest>(request)
  const { options } = await loadSettings(game)
  const setupData = () => loadSetupData(game, {})

  if (body.op === "new") {
    const table = sandboxNew(game, body.setup, options, await setupData())
    const seat = table.players[Math.min(body.setup.seat, table.players.length - 1)]!.id
    return { table, game: sandboxView(game, table, seat) }
  }

  const table = sandboxTableOf(game, body.table)
  const viewer = typeof body.viewer === "string" ? body.viewer : table.players[0]!.id
  const result = await (async () => {
    switch (body.op) {
      case "view":
        return table
      case "action":
        return sandboxAction(game, table, viewer, body.action ?? {})
      case "playFor":
        return sandboxPlayFor(game, table, Array.isArray(body.ids) ? body.ids : undefined)
      case "tick":
        return sandboxTick(game, table)
      case "load":
        return sandboxLoad(game, table, body.saved)
      case "debug":
        return sandboxDebug(game, table, String(body.command ?? ""), options, await setupData())
      default:
        throw new ApiError("INVALID_REQUEST")
    }
  })()
  return { table: result, game: sandboxView(game, result, viewer) }
})
