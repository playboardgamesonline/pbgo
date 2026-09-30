import { createHmac } from "node:crypto"
import sharp from "sharp"
import { requireAdmin } from "../../../server/admin"
import { ApiError, handle, readJson } from "../../../server/api"
import { getPlayerId } from "../../../server/player"
import { supabaseAdmin } from "../../../server/supabase"
import { FEEDBACK_TYPES, type Feedback, type FeedbackType, sanitizeText } from "../../../server/tasks"

const STATUSES: Feedback["status"][] = ["new", "read", "archived"]

const MAX_BODY = 4 * 1024 * 1024
const MAX_FILE = 3 * 1024 * 1024
const IMAGE_FORMATS = new Set(["png", "jpeg", "webp"])
const EMAIL = /^[^\s@<>()",;:\\]{1,64}@[^\s@<>()",;:\\]{1,190}\.[^\s@<>()",;:\\]{2,}$/
const BUCKET = "feedback"

/** Empreinte de l'IP (HMAC avec une clé serveur) : sert uniquement à limiter les envois, l'IP n'est jamais stockée. */
function ipHash(request: Request) {
  const ip = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim()
  if (!ip) return null
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "pgo"
  return createHmac("sha256", key).update(ip).digest("hex").slice(0, 32)
}

/** Même origine obligatoire : le formulaire n'est envoyé que depuis le site lui-même. */
function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return
  let host: string
  try {
    host = new URL(origin).host
  } catch {
    throw new ApiError("FORBIDDEN", 403)
  }
  if (host !== (request.headers.get("host") ?? new URL(request.url).host)) throw new ApiError("FORBIDDEN", 403)
}

/** Vérifie que le fichier est bien une image (décodée, pas seulement son extension), la réduit et la ré-encode en WebP : métadonnées (EXIF, GPS) et contenu caché supprimés. */
async function cleanScreenshot(file: File): Promise<Buffer> {
  if (file.size > MAX_FILE) throw new ApiError("FILE_TOO_BIG", 413)
  try {
    const input = Buffer.from(await file.arrayBuffer())
    const image = sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
    const meta = await image.metadata()
    if (!meta.format || !IMAGE_FORMATS.has(meta.format) || (meta.pages ?? 1) > 1) throw new Error("format")
    return await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError("INVALID_IMAGE")
  }
}

/** Retour d'un joueur (bouton feedback) : type, message, e-mail facultatif, capture facultative. Limites : 30 s par joueur, 1 envoi / 10 s et 5 / heure par IP, 300 / heure au total. */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request)
  const length = Number(request.headers.get("content-length"))
  if (!length || length > MAX_BODY) throw new ApiError("FILE_TOO_BIG", 413)
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new ApiError("INVALID_REQUEST")
  const form = await request.formData().catch(() => {
    throw new ApiError("INVALID_REQUEST")
  })
  const field = (name: string) => (typeof form.get(name) === "string" ? (form.get(name) as string) : "")

  // Champ piège invisible pour les humains : rempli = robot, on répond OK sans rien enregistrer
  if (field("website")) return { ok: true }

  const type = field("type") as FeedbackType
  if (!FEEDBACK_TYPES.includes(type)) throw new ApiError("INVALID_REQUEST")
  const message = sanitizeText(field("message"), 2000)
  if (!message) throw new ApiError("EMPTY_TEXT")
  const emailRaw = field("email").trim()
  if (emailRaw && (emailRaw.length > 254 || !EMAIL.test(emailRaw))) throw new ApiError("INVALID_EMAIL")

  const playerId = await getPlayerId()
  const hash = ipHash(request)
  const db = supabaseAdmin()
  const recent = async (ms: number, column?: "player_id" | "ip_hash", value?: string | null) => {
    let q = db.from("feedback").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - ms).toISOString())
    if (column && value) q = q.eq(column, value)
    const { count } = await q
    return count ?? 0
  }
  const [byPlayer, byIpShort, byIpHour, total] = await Promise.all([
    playerId ? recent(30_000, "player_id", playerId) : 0,
    hash ? recent(10_000, "ip_hash", hash) : 0,
    hash ? recent(3_600_000, "ip_hash", hash) : 0,
    recent(3_600_000),
  ])
  if (byPlayer || byIpShort || byIpHour >= 5 || total >= 300) throw new ApiError("TOO_MANY_REQUESTS", 429)

  let screenshot: string | null = null
  const file = form.get("screenshot")
  if (file instanceof File && file.size > 0) {
    const image = await cleanScreenshot(file)
    const path = `${crypto.randomUUID()}.webp`
    const { error } = await db.storage.from(BUCKET).upload(path, image, { contentType: "image/webp", upsert: false })
    if (error) throw error
    screenshot = path
  }

  const { error } = await db.from("feedback").insert({
    type,
    message,
    email: emailRaw || null,
    screenshot,
    ip_hash: hash,
    nickname: sanitizeText(field("nickname"), 40) || null,
    player_id: playerId,
    game_code: sanitizeText(field("gameCode"), 12) || null,
    page: sanitizeText(field("page"), 200) || null,
    user_agent: sanitizeText(request.headers.get("user-agent"), 300) || null,
  })
  if (error) {
    if (screenshot) await db.storage.from(BUCKET).remove([screenshot])
    throw error
  }
  return { ok: true }
})

export const GET = handle(async () => {
  await requireAdmin()
  const { data, error } = await supabaseAdmin().from("feedback").select("*").order("created_at", { ascending: false }).limit(500)
  if (error) throw new ApiError(error.code === "42P01" || error.code === "PGRST205" ? "MIGRATION_MISSING" : "SERVER_ERROR", 409)
  const rows = data as Feedback[]
  const paths = rows.map((r) => r.screenshot).filter((p): p is string => !!p)
  const urls = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await supabaseAdmin().storage.from(BUCKET).createSignedUrls(paths, 3600)
    for (const item of signed ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  }
  return rows.map((r) => ({ ...r, screenshot_url: r.screenshot ? (urls.get(r.screenshot) ?? null) : null }))
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
  const db = supabaseAdmin()
  const { data: row } = await db.from("feedback").select("screenshot").eq("id", id).maybeSingle()
  if (row?.screenshot) await db.storage.from(BUCKET).remove([row.screenshot])
  const { error } = await db.from("feedback").delete().eq("id", id)
  if (error) throw error
  return { ok: true }
})
