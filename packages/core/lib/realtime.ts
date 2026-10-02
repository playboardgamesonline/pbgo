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
export const REACTION_EVENT = "reaction"

export type ChatMessage = { id: string; playerId: string; text: string; at: number }
export type ChatReaction = { id: string; playerId: string; reaction: string }

/** Canal de chat d'une partie (diffusion temps réel Supabase, sans stockage) : messages et réactions n'existent que pour les joueurs connectés. */
export function openChat(code: string, onMessage: (m: ChatMessage) => void, onReaction?: (r: ChatReaction) => void) {
  const sb = supabase()
  if (!sb) return null
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public"
  const channel = sb
    .channel(`chat:${schema}:${code}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: CHAT_EVENT }, ({ payload }) => {
      const m = payload as Partial<ChatMessage>
      if (typeof m?.id === "string" && typeof m.playerId === "string" && typeof m.text === "string") onMessage({ id: m.id, playerId: m.playerId, text: m.text.slice(0, 240), at: Date.now() })
    })
    .on("broadcast", { event: REACTION_EVENT }, ({ payload }) => {
      const r = payload as Partial<ChatReaction>
      if (typeof r?.id === "string" && typeof r.playerId === "string" && typeof r.reaction === "string") onReaction?.({ id: r.id, playerId: r.playerId, reaction: r.reaction })
    })
    .subscribe()
  return {
    send: (m: ChatMessage) => void channel.send({ type: "broadcast", event: CHAT_EVENT, payload: m }),
    react: (r: ChatReaction) => void channel.send({ type: "broadcast", event: REACTION_EVENT, payload: r }),
    close: () => void sb.removeChannel(channel),
  }
}
