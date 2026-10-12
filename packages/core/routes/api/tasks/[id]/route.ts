import type { GameRouteContext } from "../../../../lib/binding"
import { requireAdmin } from "../../../../server/admin"
import { ApiError, handle, readJson } from "../../../../server/api"
import { supabaseAdmin } from "../../../../server/supabase"
import { isTaskId, PRIORITIES, sanitizeText, type Task, TASK_TYPES } from "../../../../server/tasks"

/** A malformed id matches no task: 404 right away, instead of the 500 of the database cast error. */
function taskId({ id }: GameRouteContext["params"]) {
  if (!isTaskId(id)) throw new ApiError("TASK_NOT_FOUND", 404)
  return id
}

export const PATCH = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await requireAdmin()
  const id = taskId(params)
  const body = await readJson<{ text?: unknown; category?: unknown; done?: unknown; sort_order?: unknown; type?: unknown; priority?: unknown }>(request)
  const patch: Partial<Task> & { updated_at: string } = { updated_at: new Date().toISOString() }
  if (typeof body.done === "boolean") patch.done = body.done
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) patch.sort_order = body.sort_order
  if (body.text !== undefined) {
    const text = sanitizeText(body.text, 300)
    if (!text) throw new ApiError("EMPTY_TEXT")
    patch.text = text
  }
  if (body.category !== undefined) patch.category = sanitizeText(body.category, 60) || "General"
  if (TASK_TYPES.includes(body.type as Task["type"])) patch.type = body.type as Task["type"]
  if (PRIORITIES.includes(body.priority as Task["priority"])) patch.priority = body.priority as Task["priority"]
  const { data, error } = await supabaseAdmin()
    .from("tasks")
    .update(patch)
    .eq("game", game.slug)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError("TASK_NOT_FOUND", 404)
  return data as Task
})

export const DELETE = handle(async (_request: Request, { game, params }: GameRouteContext) => {
  await requireAdmin()
  const id = taskId(params)
  const { error } = await supabaseAdmin()
    .from("tasks")
    .delete()
    .eq("game", game.slug)
    .eq("id", id)
  if (error) throw error
  return { ok: true }
})
