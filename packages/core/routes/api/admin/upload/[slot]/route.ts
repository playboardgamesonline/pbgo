import type { NextRequest } from "next/server"
import { requireAdmin } from "../../../../../server/admin"
import { ApiError, handle } from "../../../../../server/api"
import { isUploadSlot, removeAsset, uploadAsset } from "../../../../../server/settings"

async function slotOf(ctx: { params: Promise<{ slot: string }> }) {
  const { slot } = await ctx.params
  const decoded = decodeURIComponent(slot)
  if (!isUploadSlot(decoded)) throw new ApiError("INVALID_REQUEST", 404)
  return decoded
}

export const POST = handle(async (request: NextRequest, ctx: { params: Promise<{ slot: string }> }) => {
  await requireAdmin()
  const slot = await slotOf(ctx)
  const file = (await request.formData().catch(() => null))?.get("file")
  if (!(file instanceof File)) throw new ApiError("INVALID_FILE")
  return uploadAsset(slot, file)
})

export const DELETE = handle(async (_request: NextRequest, ctx: { params: Promise<{ slot: string }> }) => {
  await requireAdmin()
  return removeAsset(await slotOf(ctx))
})
