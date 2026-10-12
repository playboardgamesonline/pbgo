import type { GameRouteContext } from "../../../../lib/binding"
import { requireAdmin } from "../../../../server/admin"
import { ApiError, handle, readJson } from "../../../../server/api"
import { importCodeSounds, isSection, readAdminData, saveSection } from "../../../../server/settings"

/** Data of every Setup page of the admin. */
export const GET = handle(async (_request: Request, { game }: GameRouteContext) => {
  await requireAdmin()
  return readAdminData(game)
})

/** Saves one page: `{ section: "identity" | "mechanics" | "visual" | "audio" | "copy", values }`. */
export const PUT = handle(async (request: Request, { game }: GameRouteContext) => {
  await requireAdmin()
  const { section, values } = await readJson<{ section?: string; values?: Record<string, unknown> }>(request)
  if (!section || !isSection(section)) throw new ApiError("INVALID_REQUEST")
  return saveSection(game, section, values ?? {})
})

/** Actions: `{ action: "importSounds" }` sends to Sanity the sounds still served by the code. */
export const POST = handle(async (request: Request, { game }: GameRouteContext) => {
  await requireAdmin()
  const { action } = await readJson<{ action?: string }>(request)
  if (action === "importSounds") return importCodeSounds(game, new URL(request.url).origin)
  throw new ApiError("INVALID_REQUEST")
})
