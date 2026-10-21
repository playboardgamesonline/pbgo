import type { GamemasterRouteContext } from "../../../lib/binding"
import { requireAdmin } from "../../../server/admin"
import { ApiError, handle, readJson } from "../../../server/api"
import { isSection, readAdminData, saveSection } from "../../../server/settings"

/** Data of every Setup page of the admin. */
export const GET = handle(async (_request: Request, { game }: GamemasterRouteContext) => {
  await requireAdmin()
  return readAdminData(game)
})

/** Saves one page: `{ section: "identity" | "mechanics" | "visual" | "audio" | "copy", values }`. */
export const PUT = handle(async (request: Request, { game }: GamemasterRouteContext) => {
  await requireAdmin()
  const { section, values } = await readJson<{ section?: string; values?: Record<string, unknown> }>(request)
  if (!section || !isSection(section)) throw new ApiError("INVALID_REQUEST")
  return saveSection(game, section, values ?? {})
})
