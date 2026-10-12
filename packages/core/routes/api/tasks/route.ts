import type { GameRouteContext } from "../../../lib/binding"
import { requireAdmin } from "../../../server/admin"
import { ApiError, handle, readJson } from "../../../server/api"
import { supabaseAdmin } from "../../../server/supabase"
import { isMissingTable, listTasks, PRIORITIES, sanitizeText, type Task, TASK_TYPES, type TaskType } from "../../../server/tasks"

export const GET = handle(async (request: Request, { game }: GameRouteContext) => {
  await requireAdmin()
  const type = new URL(request.url).searchParams.get("type")
  const tasks = await listTasks(game.slug, TASK_TYPES.includes(type as TaskType) ? (type as TaskType) : undefined)
  if (!tasks) throw new ApiError("MIGRATION_MISSING", 409)
  return tasks
})

export const POST = handle(async (request: Request, { game }: GameRouteContext) => {
  await requireAdmin()
  const body = await readJson<{ text?: unknown; category?: unknown; type?: unknown; priority?: unknown }>(request)
  const text = sanitizeText(body.text, 300)
  if (!text) throw new ApiError("EMPTY_TEXT")
  const category = sanitizeText(body.category, 60) || "General"
  const row: Record<string, unknown> = { game: game.slug, text, category, sort_order: Date.now() / 1000 }
  if (TASK_TYPES.includes(body.type as TaskType)) row.type = body.type
  if (PRIORITIES.includes(body.priority as Task["priority"])) row.priority = body.priority
  const { data, error } = await supabaseAdmin().from("tasks").insert(row).select("*").single()
  if (isMissingTable(error)) throw new ApiError("MIGRATION_MISSING", 409)
  if (error) throw error
  return data as Task
})
