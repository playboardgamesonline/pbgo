import "server-only"
import { TAG_MAX, TAG_MIN, type Account, type Handle } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { isMissingFunction, isMissingTable } from "./db-error"
import { supabaseAdmin } from "./supabase"

// The profile of a member (PLT-39, migration 0015): nickname and tag, the provider's picture, when they joined, and whether they hide their games.
// The database makes it with the account and keeps the picture and the choice to hide in step with it. The nickname and the tag change here (`saveProfile`).
// Server key only. Without the migration every reader answers as for a member with no profile.

/** A member's profile as the database keeps it. The account's id stays on the server: no page sends it to a browser, the others know a member by their handle. */
export type ProfileRecord = {
  userId: string
  nickname: string
  tag: number
  /** The picture their provider gives, an `https` address. */
  avatarUrl: string | null
  /** Their choice to show no games, no records and no ranks on their profile (`pbgo_hide_history`, which the database copies). */
  hideHistory: boolean
  /** When the account was made, an ISO date: "member since". */
  createdAt: string
}

/** A user of the database is a uuid. The development demo account (`id: "demo"`, in no database) is not one. */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const COLUMNS = "user_id, nickname, tag, avatar_url, hide_history, created_at"

/** A profile of a member, as a handle names it. */
export const handleOf = (profile: Pick<ProfileRecord, "nickname" | "tag">): Handle => ({ nickname: profile.nickname, tag: profile.tag })

/** The picture of an account is drawn by the others, so it is an `https` address of a sensible length: the metadata of an account is edited by its owner, and the server keeps no other kind of address. */
export const pictureUrl = (url: string | null | undefined): string | null => (url && url.length <= 2048 && /^https:\/\//i.test(url) ? url : null)

/** Whether the database does not have the profiles yet: migration 0015 is not applied. */
const notApplied = (error: { code?: string } | null): boolean => isMissingTable(error) || isMissingFunction(error)

/** A row of `profiles` as a record, null when it is not one (the database checks all of it, this is only never to draw what it does not hold). */
function recordOf(row: Record<string, unknown> | null | undefined): ProfileRecord | null {
  if (!row) return null
  const tag = Number(row.tag)
  if (typeof row.nickname !== "string" || row.nickname === "" || !Number.isInteger(tag) || tag < TAG_MIN || tag > TAG_MAX) return null
  return {
    userId: String(row.user_id),
    nickname: row.nickname,
    tag,
    avatarUrl: pictureUrl(typeof row.avatar_url === "string" ? row.avatar_url : null),
    hideHistory: row.hide_history === true,
    createdAt: String(row.created_at),
  }
}

/**
 * The member that goes by this handle (case ignored), or null: nobody, a closed account, or an account that never signed in. Throws what the database says. Without the migration there is nobody.
 */
export async function readProfileByHandle(handle: Handle): Promise<ProfileRecord | null> {
  const { data, error } = await supabaseAdmin().rpc("profile_by_handle", { p_nickname: handle.nickname, p_tag: handle.tag })
  if (error) {
    if (notApplied(error)) return null
    throw error
  }
  return recordOf(Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : null)
}

/** The profiles of these accounts, by the account's id; an account that has none (or that is not a uuid) is not in the map. One read for all of them. */
export async function readProfiles(userIds: readonly string[]): Promise<Map<string, ProfileRecord>> {
  const ids = [...new Set(userIds.filter((id) => USER_ID.test(id)))]
  const found = new Map<string, ProfileRecord>()
  if (ids.length === 0) return found
  const { data, error } = await supabaseAdmin().from("profiles").select(COLUMNS).in("user_id", ids)
  if (error) {
    if (notApplied(error)) return found
    throw error
  }
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const record = recordOf(row)
    if (record) found.set(record.userId, record)
  }
  return found
}

/** The profile of one account, or null. */
export async function readProfile(userId: string): Promise<ProfileRecord | null> {
  return (await readProfiles([userId])).get(userId) ?? null
}

/**
 * The profile of a signed-in member, made on the spot when they have none: the database makes it with the account (a trigger), so this is the safety net for an account whose profile could not be made then, and costs one read when it is there.
 * Null for the demo account, which is in no database, and where the profiles are not there yet. Throws what the database says.
 */
export async function ensureProfile(account: Pick<Account, "id" | "nickname" | "avatarUrl" | "createdAt" | "preferences">): Promise<ProfileRecord | null> {
  if (isDemoAccount(account)) return null
  const existing = await readProfile(account.id)
  if (existing) return existing
  const { error } = await supabaseAdmin().rpc("make_profile", {
    p_user: account.id,
    p_nickname: account.nickname,
    p_avatar_url: pictureUrl(account.avatarUrl),
    p_hide_history: account.preferences.hideHistory,
    p_created_at: account.createdAt,
  })
  if (error) {
    if (notApplied(error)) return null
    throw error
  }
  return readProfile(account.id)
}

/** What became of a change of nickname and tag: made, or why not (somebody else has the pair; not what a profile can be; the account has no profile). */
export type ProfileChange = "ok" | "taken" | "invalid" | "missing"

/**
 * Gives a member this nickname and this tag (`set_profile`: one statement, so that the database decides when two members ask for the same pair at once). The case of the nickname does not matter for a pair to be taken, and a member never finds
 * their own pair taken. The values are judged before this (`checkNickname`, `checkTag`) and again by the database. Throws what the database says, a project without the profiles included: a change that cannot be made is told.
 */
export async function saveProfile(userId: string, handle: Handle): Promise<ProfileChange> {
  const { data, error } = await supabaseAdmin().rpc("set_profile", { p_user: userId, p_nickname: handle.nickname, p_tag: handle.tag })
  if (error) throw error
  return data === "ok" || data === "taken" || data === "invalid" ? data : "missing"
}

/** Whether an error is the database saying that the profiles are not there yet (migration 0015 is not applied), for a caller that has to tell a member so. */
export const profilesNotApplied = (error: unknown): boolean => typeof error === "object" && error !== null && notApplied(error as { code?: string })
