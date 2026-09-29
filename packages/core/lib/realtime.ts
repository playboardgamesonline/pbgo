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
