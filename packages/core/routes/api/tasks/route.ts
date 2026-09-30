import { ApiError, handle, readJson } from "../../../server/api"
import { supabaseAdmin } from "../../../server/supabase"
import { requireAdmin } from "../../../server/admin"
import { isMissingColumn, listTasks, PRIORITIES, sanitizeText, type Task, TASK_TYPES, type TaskType } from "../../../server/tasks"

export const GET = handle(async (request: Request) => {
  await requireAdmin()
  const type = new URL(request.url).searchParams.get("type")
  return listTasks(TASK_TYPES.includes(type as TaskType) ? (type as TaskType) : undefined)
})

export const POST = handle(async (request: Request) => {
  await requireAdmin()
  const body = await readJson<{ text?: unknown; category?: unknown; type?: unknown; priority?: unknown }>(request)
  const text = sanitizeText(body.text, 300)
  if (!text) throw new ApiError("EMPTY_TEXT")
  const category = sanitizeText(body.category, 60) || "General"
  const row: Record<string, unknown> = { text, category, sort_order: Date.now() / 1000 }
  if (TASK_TYPES.includes(body.type as TaskType)) row.type = body.type
  if (PRIORITIES.includes(body.priority as Task["priority"])) row.priority = body.priority
  const db = supabaseAdmin()
  let { data, error } = await db.from("tasks").insert(row).select("*").single()
  if (isMissingColumn(error)) {
    if (row.type === "bug") throw new ApiError("MIGRATION_MISSING", 409)
    ;({ data, error } = await db.from("tasks").insert({ text, category, sort_order: row.sort_order }).select("*").single())
  }
  if (error) throw error
  return { type: "backlog", priority: "medium", ...data } as Task
})
