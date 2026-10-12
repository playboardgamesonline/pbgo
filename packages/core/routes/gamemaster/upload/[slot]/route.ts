import type { GamemasterRouteContext } from "../../../../lib/binding"
import { requireAdmin } from "../../../../server/admin"
import { ApiError, handle } from "../../../../server/api"
import { isUploadSlot, removeAsset, uploadAsset } from "../../../../server/settings"

function slotOf(params: GamemasterRouteContext["params"]) {
  const slot = decodeURIComponent(params.slot ?? "")
  if (!isUploadSlot(slot)) throw new ApiError("INVALID_REQUEST", 404)
  return slot
}

export const POST = handle(async (request: Request, { game, params }: GamemasterRouteContext) => {
  await requireAdmin()
  const slot = slotOf(params)
  const file = (await request.formData().catch(() => null))?.get("file")
  if (!(file instanceof File)) throw new ApiError("INVALID_FILE")
  return uploadAsset(game, slot, file)
})

export const DELETE = handle(async (_request: Request, { game, params }: GamemasterRouteContext) => {
  await requireAdmin()
  return removeAsset(game, slotOf(params))
})
