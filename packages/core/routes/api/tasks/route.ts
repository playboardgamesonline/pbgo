import { ApiError, handle, readJson } from "../../../server/api"
import { supabaseAdmin } from "../../../server/supabase"
import { requireAdmin } from "../../../server/admin"
import { sanitizeText, type Task } from "../../../server/tasks"

export const GET = handle(async () => {
  await requireAdmin()
  const { data, error } = await supabaseAdmin().from("tasks").select("*").order("category").order("sort_order")
  if (error) throw error
  return data as Task[]
})

export const POST = handle(async (request: Request) => {
  await requireAdmin()
  const body = await readJson<{ text?: unknown; category?: unknown }>(request)
  const text = sanitizeText(body.text, 300)
  if (!text) throw new ApiError("EMPTY_TEXT")
  const category = sanitizeText(body.category, 60) || "Général"
  const { data, error } = await supabaseAdmin().from("tasks").insert({ text, category, sort_order: Date.now() / 1000 }).select("*").single()
  if (error) throw error
  return data as Task
})
