import { requireAdmin } from "../../../server/admin"
import { ApiError, handle, readJson } from "../../../server/api"
import { getPlayerId } from "../../../server/player"
import { supabaseAdmin } from "../../../server/supabase"
import { type Feedback, sanitizeText } from "../../../server/tasks"

const STATUSES: Feedback["status"][] = ["new", "read", "archived"]

/** Message d'un joueur (bouton « Donner votre avis ») : un envoi toutes les 30 s par joueur. */
export const POST = handle(async (request: Request) => {
  const body = await readJson<{ message?: unknown; nickname?: unknown; gameCode?: unknown; page?: unknown }>(request)
  const message = sanitizeText(body.message, 2000)
  if (!message) throw new ApiError("EMPTY_TEXT")
  const playerId = await getPlayerId()
  const db = supabaseAdmin()
  if (playerId) {
    const since = new Date(Date.now() - 30_000).toISOString()
    const { count } = await db.from("feedback").select("id", { count: "exact", head: true }).eq("player_id", playerId).gte("created_at", since)
    if (count) throw new ApiError("TOO_MANY_REQUESTS", 429)
  }
  const { error } = await db.from("feedback").insert({
    message,
    nickname: sanitizeText(body.nickname, 40) || null,
    player_id: playerId,
    game_code: sanitizeText(body.gameCode, 12) || null,
    page: sanitizeText(body.page, 200) || null,
    user_agent: sanitizeText(request.headers.get("user-agent"), 300) || null,
  })
  if (error) throw error
  return { ok: true }
})

export const GET = handle(async () => {
  await requireAdmin()
  const { data, error } = await supabaseAdmin().from("feedback").select("*").order("created_at", { ascending: false }).limit(500)
  if (error) throw new ApiError(error.code === "42P01" || error.code === "PGRST205" ? "MIGRATION_MISSING" : "SERVER_ERROR", 409)
  return data as Feedback[]
})

export const PATCH = handle(async (request: Request) => {
  await requireAdmin()
  const { id, status } = await readJson<{ id?: unknown; status?: unknown }>(request)
  if (typeof id !== "string" || !STATUSES.includes(status as Feedback["status"])) throw new ApiError("INVALID_REQUEST")
  const { data, error } = await supabaseAdmin().from("feedback").update({ status }).eq("id", id).select("*").maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError("NOT_FOUND", 404)
  return data as Feedback
})

export const DELETE = handle(async (request: Request) => {
  await requireAdmin()
  const id = new URL(request.url).searchParams.get("id")
  if (!id) throw new ApiError("INVALID_REQUEST")
  const { error } = await supabaseAdmin().from("feedback").delete().eq("id", id)
  if (error) throw error
  return { ok: true }
})
