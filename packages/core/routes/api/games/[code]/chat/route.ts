import { after } from "next/server"
import type { GameBinding, GameRouteContext } from "../../../../../lib/binding"
import {
  CHAT_ID,
  CHAT_MAX_LENGTH,
  CHAT_SERVER_EVENT,
  DEFAULT_REACTION_IDS,
  REACTION_SERVER_EVENT,
  chatChannel,
  type ChatMessage,
  type ChatReaction,
} from "../../../../../lib/chat"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { readGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { markSeen } from "../../../../../server/presence"
import { supabaseAdmin } from "../../../../../server/supabase"

/** Reactions a player may send: the common ones plus the game's own (`REACTIONS` of its binding). */
const reactionIds = new WeakMap<GameBinding, Set<string>>()
function allowedReactions(binding: GameBinding): Set<string> {
  let ids = reactionIds.get(binding)
  if (!ids) {
    ids = new Set([...DEFAULT_REACTION_IDS, ...(binding.REACTIONS ?? []).map((r) => r.id)])
    reactionIds.set(binding, ids)
  }
  return ids
}

/**
 * Per-player token bucket: bursts of `CAPACITY` sends, then `REFILL_PER_SECOND`.
 * In memory, so per server instance: on serverless each warm instance keeps its own buckets and a cold start resets them.
 * It stops a single client from flooding the table, not a distributed abuse (that would need a shared store).
 */
const CAPACITY = 8
const REFILL_PER_SECOND = 2
const MAX_BUCKETS = 5000
const buckets = new Map<string, { tokens: number; at: number }>()

function take(key: string): boolean {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { tokens: CAPACITY, at: now }
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + ((now - bucket.at) / 1000) * REFILL_PER_SECOND)
  bucket.at = now
  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    // full buckets carry no information: drop them before growing further
    for (const [id, b] of buckets) if (b.tokens + ((now - b.at) / 1000) * REFILL_PER_SECOND >= CAPACITY) buckets.delete(id)
  }
  buckets.set(key, bucket)
  if (bucket.tokens < 1) return false
  bucket.tokens -= 1
  return true
}

type Body = { id?: unknown; text?: unknown; reaction?: unknown }

/**
 * Chat message or reaction: the author is the player from the cookie, never from the body.
 * Broadcast server-side on the chat channel (nothing is stored).
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  const playerId = await getPlayerId(game.slug)
  if (!playerId) throw new ApiError("UNKNOWN_PLAYER", 401)
  const body = await readJson<Body>(request)
  const id = typeof body.id === "string" && CHAT_ID.test(body.id) ? body.id : crypto.randomUUID()

  let event: string
  let payload: ChatMessage | ChatReaction
  if (body.reaction !== undefined) {
    if (typeof body.reaction !== "string" || !allowedReactions(game.binding).has(body.reaction)) throw new ApiError("INVALID_REQUEST")
    event = REACTION_SERVER_EVENT
    payload = { id, playerId, reaction: body.reaction }
  } else {
    const text = typeof body.text === "string" ? body.text.trim() : ""
    if (!text) throw new ApiError("EMPTY_TEXT")
    if (text.length > CHAT_MAX_LENGTH) throw new ApiError("INVALID_REQUEST")
    event = CHAT_SERVER_EVENT
    payload = { id, playerId, text, at: Date.now() }
  }

  const row = await readGame(game, params.code ?? "")
  if (!row.players.some((p) => p.id === playerId)) throw new ApiError("UNKNOWN_PLAYER", 403)
  if (!take(`${game.slug}:${playerId}`)) throw new ApiError("TOO_MANY_REQUESTS", 429)
  after(() => markSeen(game, row, playerId))

  const result = await supabaseAdmin().channel(chatChannel(game.slug, row.code)).httpSend(event, payload)
  if (!result.success) throw new Error(`Chat broadcast failed (${result.status}): ${result.error}`)
  return payload
})
