import "server-only"
import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Server client of the Supabase project (service role). Every game shares the `public` tables: each row carries its game
 * in the `game` column (the registry slug), so every query filters on it (`supabase/migrations`).
 */
export function supabaseAdmin() {
  if (!url || !secret) throw new Error("Supabase env missing (SUPABASE_URL / SUPABASE_SECRET_KEY)")
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
}
