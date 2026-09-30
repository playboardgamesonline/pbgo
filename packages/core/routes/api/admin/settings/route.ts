import { requireAdmin } from "../../../../server/admin"
import { ApiError, handle, readJson } from "../../../../server/api"
import { importCodeSounds, isSection, readAdminData, saveSection } from "../../../../server/settings"

/** Données de toutes les pages Setup de l'admin. */
export const GET = handle(async () => {
  await requireAdmin()
  return readAdminData()
})

/** Enregistre une page : `{ section: "identity" | "mechanics" | "visual" | "audio" | "copy", values }`. */
export const PUT = handle(async (request: Request) => {
  await requireAdmin()
  const { section, values } = await readJson<{ section?: string; values?: Record<string, unknown> }>(request)
  if (!section || !isSection(section)) throw new ApiError("INVALID_REQUEST")
  return saveSection(section, values ?? {})
})

/** Actions : `{ action: "importSounds" }` envoie dans Sanity les sons encore servis par le code. */
export const POST = handle(async (request: Request) => {
  await requireAdmin()
  const { action } = await readJson<{ action?: string }>(request)
  if (action === "importSounds") return importCodeSounds(new URL(request.url).origin)
  throw new ApiError("INVALID_REQUEST")
})
