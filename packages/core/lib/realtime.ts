"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { UPDATE_EVENT, gameChannel } from "./game-types"
import { CHAT_MAX_LENGTH, CHAT_SERVER_EVENT, REACTION_SERVER_EVENT, chatChannel, type ChatMessage, type ChatReaction } from "./chat"

let client: SupabaseClient | null = null

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  client ??= createClient(url, key, { auth: { persistSession: false } })
  return client
}

export function subscribeToGame(code: string, onUpdate: (version: number) => void): () => void {
  const sb = supabase()
  if (!sb) return () => {}
  const channel = sb
    .channel(gameChannel(code))
    .on("broadcast", { event: UPDATE_EVENT }, ({ payload }) => onUpdate((payload as { version: number }).version))
    .subscribe()
  return () => {
    sb.removeChannel(channel)
  }
}

export type { ChatMessage, ChatReaction } from "./chat"

/**
 * Chat channel of a game (Supabase Realtime broadcast, nothing stored): messages and reactions only exist for connected players.
 * Listen-only: sending goes through `POST /api/games/[code]/chat`, which sets the author from the player cookie and broadcasts
 * the `*_SERVER_EVENT` events. Events sent directly by clients (legacy `chat` / `reaction`) are ignored.
 */
export function openChat(code: string, onMessage: (m: ChatMessage) => void, onReaction?: (r: ChatReaction) => void) {
  const sb = supabase()
  if (!sb) return null
  const channel = sb
    .channel(chatChannel(code))
    .on("broadcast", { event: CHAT_SERVER_EVENT }, ({ payload }) => {
      const m = payload as Partial<ChatMessage>
      if (typeof m?.id === "string" && typeof m.playerId === "string" && typeof m.text === "string") onMessage({ id: m.id, playerId: m.playerId, text: m.text.slice(0, CHAT_MAX_LENGTH), at: Date.now() })
    })
    .on("broadcast", { event: REACTION_SERVER_EVENT }, ({ payload }) => {
      const r = payload as Partial<ChatReaction>
      if (typeof r?.id === "string" && typeof r.playerId === "string" && typeof r.reaction === "string") onReaction?.({ id: r.id, playerId: r.playerId, reaction: r.reaction })
    })
    .subscribe()
  return { close: () => void sb.removeChannel(channel) }
}
