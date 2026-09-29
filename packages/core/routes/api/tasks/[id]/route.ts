import type { NextRequest } from "next/server"
import { ApiError, handle, readJson } from "../../../../server/api"
import { supabaseAdmin } from "../../../../server/supabase"
import { requireAdmin } from "../../../../server/admin"
import { sanitizeText, type Task } from "../../../../server/tasks"

export const PATCH = handle(async (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const body = await readJson<{ text?: unknown; category?: unknown; done?: unknown; sort_order?: unknown }>(request)
  const patch: Partial<Task> & { updated_at: string } = { updated_at: new Date().toISOString() }
  if (typeof body.done === "boolean") patch.done = body.done
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) patch.sort_order = body.sort_order
  if (body.text !== undefined) {
    const text = sanitizeText(body.text, 300)
    if (!text) throw new ApiError("EMPTY_TEXT")
    patch.text = text
  }
  if (body.category !== undefined) patch.category = sanitizeText(body.category, 60) || "Général"
  const { data, error } = await supabaseAdmin().from("tasks").update(patch).eq("id", id).select("*").maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError("TASK_NOT_FOUND", 404)
  return data as Task
})

export const DELETE = handle(async (_request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const { error } = await supabaseAdmin().from("tasks").delete().eq("id", id)
  if (error) throw error
  return { ok: true }
})
