import * as binding from "@pbgo/binding"
import type { NextRequest } from "next/server"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { getPlayerId } from "../../../../../server/player"
import { readGame } from "../../../../../server/games"
import { supabaseAdmin } from "../../../../../server/supabase"
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

const REACTION_IDS = new Set<string>([
  ...DEFAULT_REACTION_IDS,
  ...((binding as { REACTIONS?: { id: string }[] }).REACTIONS ?? []).map((r) => r.id),
])

/**
 * Per-player token bucket: bursts of `CAPACITY` sends, then `REFILL_PER_SECOND`.
 * In memory, so per server instance: on serverless each warm instance keeps its own buckets and a cold start resets them.
 * It stops a single client from flooding the table, not a distributed abuse (that would need a shared store).
 */
const CAPACITY = 8
const REFILL_PER_SECOND = 2
const MAX_BUCKETS = 5000
const buckets = new Map<string, { tokens: number; at: number }>()

function take(playerId: string): boolean {
  const now = Date.now()
  const bucket = buckets.get(playerId) ?? { tokens: CAPACITY, at: now }
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + ((now - bucket.at) / 1000) * REFILL_PER_SECOND)
  bucket.at = now
  if (buckets.size >= MAX_BUCKETS && !buckets.has(playerId)) {
    // full buckets carry no information: drop them before growing further
    for (const [id, b] of buckets) if (b.tokens + ((now - b.at) / 1000) * REFILL_PER_SECOND >= CAPACITY) buckets.delete(id)
  }
  buckets.set(playerId, bucket)
  if (bucket.tokens < 1) return false
  bucket.tokens -= 1
  return true
}

type Body = { id?: unknown; text?: unknown; reaction?: unknown }

/**
 * Chat message or reaction: the author is the player from the cookie, never from the body.
 * Broadcast server-side on the chat channel (nothing is stored).
 */
export const POST = handle(async (request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params
  const playerId = await getPlayerId()
  if (!playerId) throw new ApiError("UNKNOWN_PLAYER", 401)
  const body = await readJson<Body>(request)
  const id = typeof body.id === "string" && CHAT_ID.test(body.id) ? body.id : crypto.randomUUID()

  let event: string
  let payload: ChatMessage | ChatReaction
  if (body.reaction !== undefined) {
    if (typeof body.reaction !== "string" || !REACTION_IDS.has(body.reaction)) throw new ApiError("INVALID_REQUEST")
    event = REACTION_SERVER_EVENT
    payload = { id, playerId, reaction: body.reaction }
  } else {
    const text = typeof body.text === "string" ? body.text.trim() : ""
    if (!text) throw new ApiError("EMPTY_TEXT")
    if (text.length > CHAT_MAX_LENGTH) throw new ApiError("INVALID_REQUEST")
    event = CHAT_SERVER_EVENT
    payload = { id, playerId, text, at: Date.now() }
  }

  const game = await readGame(code)
  if (!game.players.some((p) => p.id === playerId)) throw new ApiError("UNKNOWN_PLAYER", 403)
  if (!take(playerId)) throw new ApiError("TOO_MANY_REQUESTS", 429)

  const result = await supabaseAdmin().channel(chatChannel(game.code)).httpSend(event, payload)
  if (!result.success) throw new Error(`Chat broadcast failed (${result.status}): ${result.error}`)
  return payload
})
