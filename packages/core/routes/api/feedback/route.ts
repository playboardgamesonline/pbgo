import { createHmac } from "node:crypto"
import sharp from "sharp"
import type { GameRouteContext } from "../../../lib/binding"
import { ApiError, handle } from "../../../server/api"
import { getPlayerId } from "../../../server/player"
import { rateLimit } from "../../../server/rate-limit"
import { clientIp } from "../../../server/rate-limiter"
import { supabaseAdmin } from "../../../server/supabase"
import { FEEDBACK_BUCKET, FEEDBACK_TYPES, type FeedbackType, sanitizeText } from "../../../server/tasks"

const MAX_BODY = 4 * 1024 * 1024
const MAX_FILE = 3 * 1024 * 1024
const IMAGE_FORMATS = new Set(["png", "jpeg", "webp"])
const EMAIL = /^[^\s@<>()",;:\\]{1,64}@[^\s@<>()",;:\\]{1,190}\.[^\s@<>()",;:\\]{2,}$/

/** Fingerprint of the IP (HMAC with a server key): only used to limit sends, the IP itself is never stored. */
function ipHash(request: Request) {
  const ip = clientIp(request.headers)
  if (!ip) return null
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "pbgo"
  return createHmac("sha256", key).update(ip).digest("hex").slice(0, 32)
}

/** Same origin required: the form is only sent from the site itself. */
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

/** Checks that the file really is an image (decoded, not just its extension), shrinks it and re-encodes it as WebP: metadata (EXIF, GPS) and hidden content are dropped. */
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

/**
 * Player feedback (feedback button): type, message, optional e-mail, optional screenshot. Limits: 30 s per player,
 * 1 send / 10 s and 5 / hour per IP (across every game), 300 / hour per game.
 */
export const POST = handle(async (request: Request, { game }: GameRouteContext) => {
  assertSameOrigin(request)
  // Cheap in-memory gate (shared helper, per server instance) before parsing the body; the durable limits are counted in the database below
  await rateLimit(game.slug, request, "feedback", { code: "TOO_MANY_REQUESTS" })
  const length = Number(request.headers.get("content-length"))
  if (!length || length > MAX_BODY) throw new ApiError("FILE_TOO_BIG", 413)
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new ApiError("INVALID_REQUEST")
  const form = await request.formData().catch(() => {
    throw new ApiError("INVALID_REQUEST")
  })
  const field = (name: string) => (typeof form.get(name) === "string" ? (form.get(name) as string) : "")

  // Honeypot field, invisible to humans: filled in = robot, answer OK without storing anything
  if (field("website")) return { ok: true }

  const type = field("type") as FeedbackType
  if (!FEEDBACK_TYPES.includes(type)) throw new ApiError("INVALID_REQUEST")
  const message = sanitizeText(field("message"), 2000)
  if (!message) throw new ApiError("EMPTY_TEXT")
  const emailRaw = field("email").trim()
  if (emailRaw && (emailRaw.length > 254 || !EMAIL.test(emailRaw))) throw new ApiError("INVALID_EMAIL")

  const playerId = await getPlayerId(game.slug)
  const hash = ipHash(request)
  const db = supabaseAdmin()
  // player and total limits count within this game; IP limits across every game
  const recent = async (ms: number, filter: { game?: string; player_id?: string; ip_hash?: string }) => {
    let q = db.from("feedback").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - ms).toISOString())
    for (const [column, value] of Object.entries(filter)) q = q.eq(column, value)
    const { count } = await q
    return count ?? 0
  }
  const [byPlayer, byIpShort, byIpHour, total] = await Promise.all([
    playerId ? recent(30_000, { game: game.slug, player_id: playerId }) : 0,
    hash ? recent(10_000, { ip_hash: hash }) : 0,
    hash ? recent(3_600_000, { ip_hash: hash }) : 0,
    recent(3_600_000, { game: game.slug }),
  ])
  if (byPlayer || byIpShort || byIpHour >= 5 || total >= 300) throw new ApiError("TOO_MANY_REQUESTS", 429)

  let screenshot: string | null = null
  const file = form.get("screenshot")
  if (file instanceof File && file.size > 0) {
    const image = await cleanScreenshot(file)
    const path = `${game.slug}/${crypto.randomUUID()}.webp`
    const { error } = await db.storage.from(FEEDBACK_BUCKET).upload(path, image, { contentType: "image/webp", upsert: false })
    if (error) throw error
    screenshot = path
  }

  const { error } = await db.from("feedback").insert({
    game: game.slug,
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
    if (screenshot) await db.storage.from(FEEDBACK_BUCKET).remove([screenshot])
    throw error
  }
  return { ok: true }
})
