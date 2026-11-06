"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { UPDATE_EVENT, gameChannel, loadingChannel } from "./game-types"
import { CHAT_MAX_LENGTH, CHAT_SERVER_EVENT, REACTION_SERVER_EVENT, chatChannel, type ChatMessage, type ChatReaction } from "./chat"

let client: SupabaseClient | null = null

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  client ??= createClient(url, key, { auth: { persistSession: false } })
  return client
}

export function subscribeToGame(slug: string, code: string, onUpdate: (version: number) => void): () => void {
  const sb = supabase()
  if (!sb) return () => {}
  const channel = sb
    .channel(gameChannel(slug, code))
    .on("broadcast", { event: UPDATE_EVENT }, ({ payload }) => onUpdate((payload as { version: number }).version))
    .subscribe()
  return () => {
    sb.removeChannel(channel)
  }
}

export type { ChatMessage, ChatReaction } from "./chat"

/**
 * Chat channel of a game (Supabase Realtime broadcast, nothing stored): messages and reactions only exist for connected players.
 * Listen-only: sending goes through `POST /api/<slug>/games/[code]/chat`, which sets the author from the player cookie and broadcasts
 * the `*_SERVER_EVENT` events. Events sent directly by clients (legacy `chat` / `reaction`) are ignored.
 */
export function openChat(slug: string, code: string, onMessage: (m: ChatMessage) => void, onReaction?: (r: ChatReaction) => void) {
  const sb = supabase()
  if (!sb) return null
  const channel = sb
    .channel(chatChannel(slug, code))
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

/** How far each board of a table is loaded, by player id (0 to 1), as the boards report it to each other. */
export type LoadingProgress = Record<string, number>

/** Reports at most this often, in milliseconds: the bar of the start screen is smooth enough, and the channel is not flooded */
const REPORT_EVERY_MS = 250

/**
 * The loading channel of a table: every board of the table that is `starting` tells the others how far it is (`report`, 0 to 1) and hears them (`onChange`, everybody's last word, the viewer's own included). It is presence, so nothing is stored
 * and a board that closes leaves the channel: it only paints the collective bar of the start screen. What lets the game begin is not here, it is the table's own list of those who are ready (`POST …/ready`); a board that cannot reach the
 * channel (no Realtime) just shows no progress for the others. Null without a Supabase configuration.
 */
export function openLoading(slug: string, code: string, playerId: string, onChange: (progress: LoadingProgress) => void) {
  const sb = supabase()
  if (!sb) return null
  const channel = sb.channel(loadingChannel(slug, code), { config: { presence: { key: playerId } } })
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<{ progress?: number }>()
    onChange(Object.fromEntries(Object.entries(state).map(([id, metas]) => [id, Number(metas.at(-1)?.progress) || 0])))
  })

  let subscribed = false
  let latest: number | null = null
  let sentAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    timer = null
    if (latest === null || !subscribed) return
    sentAt = Date.now()
    void channel.track({ progress: latest })
  }
  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return
    subscribed = true
    flush()
  })

  return {
    report(progress: number) {
      latest = progress
      if (!timer) timer = setTimeout(flush, Math.max(0, REPORT_EVERY_MS - (Date.now() - sentAt)))
    },
    close() {
      if (timer) clearTimeout(timer)
      void sb.removeChannel(channel)
    },
  }
}
