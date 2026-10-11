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

/** Table absent: the database migration (`supabase/migrations`) has not been applied yet. */
export const isMissingTable = (error: { code?: string } | null) => error?.code === "42P01" || error?.code === "PGRST205"

/** Tasks of one game (`slug`), all types or one. */
export async function listTasks(slug: string, type?: TaskType): Promise<Task[] | null> {
  let query = supabaseAdmin().from("tasks").select("*").eq("game", slug).order("category").order("sort_order")
  if (type) query = query.eq("type", type)
  const { data, error } = await query
  if (isMissingTable(error)) return null
  if (error) throw error
  return data as Task[]
}

export const FEEDBACK_TYPES = ["review", "bug", "suggestion", "other"] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export type Feedback = {
  id: string
  created_at: string
  type: FeedbackType
  message: string
  email: string | null
  /** Path in the private `feedback` bucket (never shown to players). */
  screenshot: string | null
  /** Signed URL (1 h), added by GET /api/<slug>/feedback for the admin. */
  screenshot_url?: string | null
  nickname: string | null
  game_code: string | null
  page: string | null
  user_agent: string | null
  status: "new" | "read" | "archived"
}

/** Sidebar counters of one game (null = table missing). */
export async function taskCounts(slug: string) {
  const db = supabaseAdmin()
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await q
    return error ? null : (count ?? 0)
  }
  const [backlog, bugs, feedback] = await Promise.all([
    count(db.from("tasks").select("id", { count: "exact", head: true }).eq("game", slug).eq("type", "backlog").eq("done", false)),
    count(db.from("tasks").select("id", { count: "exact", head: true }).eq("game", slug).eq("type", "bug").eq("done", false)),
    count(db.from("feedback").select("id", { count: "exact", head: true }).eq("game", slug).eq("status", "new")),
  ])
  return { backlog, bugs, feedback }
}
