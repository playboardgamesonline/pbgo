import "server-only"
import { supabaseAdmin } from "./supabase"

export type TaskType = "backlog" | "bug"
export type TaskPriority = "high" | "medium" | "low"
export type Task = {
  id: string
  text: string
  category: string
  done: boolean
  sort_order: number
  created_at: string
  type: TaskType
  priority: TaskPriority
}

export const TASK_TYPES: TaskType[] = ["backlog", "bug"]
export const PRIORITIES: TaskPriority[] = ["high", "medium", "low"]

export function sanitizeText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

/** Colonnes `type` / `priority` absentes tant que la migration 0003/0004 n'est pas passée : tout est alors du Backlog. */
export const isMissingColumn = (error: { code?: string } | null) => error?.code === "42703" || error?.code === "PGRST204"

export async function listTasks(type?: TaskType): Promise<{ tasks: Task[]; migrated: boolean }> {
  const db = supabaseAdmin()
  let query = db.from("tasks").select("*").order("category").order("sort_order")
  if (type) query = query.eq("type", type)
  const { data, error } = await query
  if (isMissingColumn(error)) {
    if (type === "bug") return { tasks: [], migrated: false }
    const legacy = await db.from("tasks").select("*").order("category").order("sort_order")
    if (legacy.error) throw legacy.error
    return { tasks: (legacy.data as Task[]).map((t) => ({ ...t, type: "backlog", priority: "medium" })), migrated: false }
  }
  if (error) throw error
  return { tasks: data as Task[], migrated: true }
}

export const FEEDBACK_TYPES = ["review", "bug", "suggestion", "other"] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export type Feedback = {
  id: string
  created_at: string
  type: FeedbackType
  message: string
  email: string | null
  /** Chemin dans le bucket privé « feedback » (jamais exposé aux joueurs). */
  screenshot: string | null
  /** URL signée (1 h), ajoutée par GET /api/feedback pour l'admin. */
  screenshot_url?: string | null
  nickname: string | null
  game_code: string | null
  page: string | null
  user_agent: string | null
  status: "new" | "read" | "archived"
}

/** Compteurs de la barre latérale (null = table ou colonne absente). */
export async function taskCounts() {
  const db = supabaseAdmin()
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await q
    return error ? null : (count ?? 0)
  }
  const [backlog, bugs, feedback] = await Promise.all([
    count(db.from("tasks").select("id", { count: "exact", head: true }).eq("type", "backlog").eq("done", false)),
    count(db.from("tasks").select("id", { count: "exact", head: true }).eq("type", "bug").eq("done", false)),
    count(db.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new")),
  ])
  return { backlog, bugs, feedback }
}
