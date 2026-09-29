import "server-only"
import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

export function supabaseAdmin() {
  if (!url || !secret) throw new Error("Supabase env manquante (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
}
