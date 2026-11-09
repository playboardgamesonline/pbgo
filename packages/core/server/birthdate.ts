import "server-only"
import { supabaseAdmin } from "./supabase"

// The date of birth a member declared, kept where only the server reads and writes it (`member_birthdates`, migration 0012; PLT-125). It is not in the member's `user_metadata`, which they can rewrite from their browser: a check of the age
// has to trust a place they cannot. It is a declaration, never a proof, and it is declared once: the database refuses to replace a date that is there (`set_member_birthdate`), so a refusal cannot be got round by declaring another date.

/** The date of birth (`YYYY-MM-DD`) that each of these accounts declared; an account that declared none is not in the map. Throws what the database says: a check of the age that cannot read the dates must not let anybody through. */
export async function readBirthdates(userIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return new Map()
  const { data, error } = await supabaseAdmin().from("member_birthdates").select("user_id, birthdate").in("user_id", ids)
  if (error) throw error
  return new Map((data ?? []).map((row) => [String(row.user_id), String(row.birthdate)]))
}

/** The date of birth that the account declared, or null when it declared none. */
export async function readBirthdate(userId: string): Promise<string | null> {
  return (await readBirthdates([userId])).get(userId) ?? null
}

/** Keeps the date of birth that an account declares (`YYYY-MM-DD`, already judged by `birthdateProblem`). True when it is kept; false when the account has one already, which is never replaced. */
export async function saveBirthdate(userId: string, birthdate: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("set_member_birthdate", { p_user: userId, p_birthdate: birthdate })
  if (error) throw error
  return data === true
}
