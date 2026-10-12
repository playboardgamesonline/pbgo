import type { GamemasterRouteContext } from "../../../lib/binding"
import { requireAdmin } from "../../../server/admin"
import { ApiError, handle, readJson } from "../../../server/api"
import { supabaseAdmin } from "../../../server/supabase"
import { FEEDBACK_BUCKET, FEEDBACK_STATUSES, type Feedback, isMissingTable } from "../../../server/tasks"

export const GET = handle(async (_request: Request, { game }: GamemasterRouteContext) => {
  await requireAdmin()
  const { data, error } = await supabaseAdmin()
    .from("feedback")
    .select("*")
    .eq("game", game.slug)
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) throw new ApiError(isMissingTable(error) ? "MIGRATION_MISSING" : "SERVER_ERROR", 409)
  const rows = data as Feedback[]
  const paths = rows.map((r) => r.screenshot).filter((p): p is string => !!p)
  const urls = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await supabaseAdmin().storage.from(FEEDBACK_BUCKET).createSignedUrls(paths, 3600)
    for (const item of signed ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  }
  return rows.map((r) => ({ ...r, screenshot_url: r.screenshot ? (urls.get(r.screenshot) ?? null) : null }))
})

export const PATCH = handle(async (request: Request, { game }: GamemasterRouteContext) => {
  await requireAdmin()
  const { id, status } = await readJson<{ id?: unknown; status?: unknown }>(request)
  if (typeof id !== "string" || !FEEDBACK_STATUSES.includes(status as Feedback["status"])) throw new ApiError("INVALID_REQUEST")
  const { data, error } = await supabaseAdmin().from("feedback").update({ status }).eq("game", game.slug).eq("id", id).select("*").maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError("NOT_FOUND", 404)
  return data as Feedback
})

export const DELETE = handle(async (request: Request, { game }: GamemasterRouteContext) => {
  await requireAdmin()
  const id = new URL(request.url).searchParams.get("id")
  if (!id) throw new ApiError("INVALID_REQUEST")
  const db = supabaseAdmin()
  const { data: row } = await db.from("feedback").select("screenshot").eq("game", game.slug).eq("id", id).maybeSingle()
  if (row?.screenshot) await db.storage.from(FEEDBACK_BUCKET).remove([row.screenshot])
  const { error } = await db.from("feedback").delete().eq("game", game.slug).eq("id", id)
  if (error) throw error
  return { ok: true }
})
