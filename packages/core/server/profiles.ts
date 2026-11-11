import "server-only"
import { TAG_MAX, TAG_MIN, detailsOf, noProfileDetails, type Account, type Handle, type ProfileDetails, type ProfileEdit } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { isMissingColumn, isMissingFunction, isMissingTable } from "./db-error"
import { supabaseAdmin } from "./supabase"

// The profile of a member (PLT-39, migration 0015): nickname and tag, the provider's picture, when they joined, and whether they hide their games, and what they say of themselves (migration 0018): pronouns, country, favourite games, a bio.
// The database makes it with the account and keeps the picture and the choice to hide in step with it. What the member says of themselves changes here (`saveProfile`), in one call that is whole or nothing.
// Server key only. Without a migration every reader answers as for a member with no profile, or with nothing to say of themselves.

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

/** A profile with what its member says of themselves: what the page of a profile is made of. The details are read apart from the record (`readProfileDetails`) wherever only the identity is needed, which is every other reader of the profiles. */
export type ProfileWithDetails = ProfileRecord & { details: ProfileDetails }

/** A user of the database is a uuid. The development demo account (`id: "demo"`, in no database) is not one. */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const COLUMNS = "user_id, nickname, tag, avatar_url, hide_history, created_at"

// What a member says of themselves is read apart from the identity: the seats, the leaderboards and the histories read the identity of a hundred members at a time and never need it, and a database that has not got migration 0018 yet still answers them
const DETAIL_COLUMNS = "pronouns, country, favorite_games, bio, city_id, city_name, city_country"

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
 * The member that goes by this handle (case ignored), with what they say of themselves, or null: nobody, a closed account, or an account that never signed in. Throws what the database says. Without migration 0015 there is nobody; without 0018 the lookup
 * answers with no details.
 */
export async function readProfileByHandle(handle: Handle): Promise<ProfileWithDetails | null> {
  const { data, error } = await supabaseAdmin().rpc("profile_by_handle", { p_nickname: handle.nickname, p_tag: handle.tag })
  if (error) {
    if (notApplied(error)) return null
    throw error
  }
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined
  const record = recordOf(row)
  return record ? { ...record, details: detailsOf(row) } : null
}

/**
 * What one account says of itself on its profile: pronouns, country, city, favourite games, bio. It says nothing for an account that has no profile, for the demo account (which is in no database) and where migration 0018 is not applied. Throws what else the database says.
 */
export async function readProfileDetails(userId: string): Promise<ProfileDetails> {
  if (!USER_ID.test(userId)) return noProfileDetails()
  const { data, error } = await supabaseAdmin().from("profiles").select(DETAIL_COLUMNS).eq("user_id", userId).maybeSingle()
  if (error) {
    if (notApplied(error) || isMissingColumn(error)) return noProfileDetails()
    throw error
  }
  return detailsOf(data as Record<string, unknown> | null)
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

/** What became of a change of a profile: made, or why not (somebody else has the nickname and tag; not what a profile can be; the account has no profile). */
export type ProfileChange = "ok" | "taken" | "invalid" | "missing"

/** The name of each field of an edit in the object that `set_profile` takes (the columns of the table). */
const COLUMN_OF: Readonly<Record<keyof ProfileEdit, string>> = { nickname: "nickname", tag: "tag", pronouns: "pronouns", country: "country", city: "city", favoriteGames: "favorite_games", bio: "bio" }

/**
 * Changes what a member's profile says (`set_profile`, the only writer): the fields of `edit` that are there, all or none, in one statement, so that the database decides when two members ask for the same nickname and tag at once. A field that is not there stays as it is. The
 * case of the nickname does not matter for a pair to be taken, and a member never finds their own pair taken. The values are judged before this (`parseProfileEdit`) and again by the database. An edit with no field is invalid, and asks nothing. Throws what the database says, a project
 * without the profiles included: a change that cannot be made is told.
 */
export async function saveProfile(userId: string, edit: ProfileEdit): Promise<ProfileChange> {
  const changes: Record<string, unknown> = {}
  for (const key of Object.keys(COLUMN_OF) as (keyof ProfileEdit)[]) {
    const value = edit[key]
    if (value !== undefined) changes[COLUMN_OF[key]] = value
  }
  if (Object.keys(changes).length === 0) return "invalid"
  const { data, error } = await supabaseAdmin().rpc("set_profile", { p_user: userId, p_changes: changes })
  if (error) throw error
  return data === "ok" || data === "taken" || data === "invalid" ? data : "missing"
}

/** Whether an error is the database saying that the profiles are not there yet (migration 0015 is not applied, or 0018, which `set_profile` of now is), for a caller that has to tell a member so. */
export const profilesNotApplied = (error: unknown): boolean => typeof error === "object" && error !== null && notApplied(error as { code?: string })
