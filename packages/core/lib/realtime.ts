"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { UPDATE_EVENT, gameChannel } from "./game-types"

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

export const CHAT_EVENT = "chat"
export type ChatMessage = { id: string; playerId: string; text: string; at: number }

/** Canal de chat d'une partie (diffusion temps réel Supabase, sans stockage) : les messages n'existent que pour les joueurs connectés. */
export function openChat(code: string, onMessage: (m: ChatMessage) => void) {
  const sb = supabase()
  if (!sb) return null
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public"
  const channel = sb
    .channel(`chat:${schema}:${code}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: CHAT_EVENT }, ({ payload }) => {
      const m = payload as Partial<ChatMessage>
      if (typeof m?.id === "string" && typeof m.playerId === "string" && typeof m.text === "string") onMessage({ id: m.id, playerId: m.playerId, text: m.text.slice(0, 240), at: Date.now() })
    })
    .subscribe()
  return {
    send: (m: ChatMessage) => void channel.send({ type: "broadcast", event: CHAT_EVENT, payload: m }),
    close: () => void sb.removeChannel(channel),
  }
}
