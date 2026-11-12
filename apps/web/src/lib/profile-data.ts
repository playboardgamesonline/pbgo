import "server-only"
import { cache } from "react"
import { noProfileDetails, profileViewOf, type Account, type Handle, type ProfileDetails } from "@pbgo/accounts"
import { DEMO_TAG, isDemoAccount } from "@pbgo/accounts/demo"
import type { FriendRelation } from "@pbgo/core/lib/friends"
import { readRelation } from "@pbgo/core/server/friends"
import { ensureProfile, readProfileByHandle, readProfileDetails, type ProfileWithDetails } from "@pbgo/core/server/profiles"
import { memberGames, type MemberGames } from "./member-games"

// What the pages of a profile say (PLT-39, PLT-111): the member's own (`/me`) and anybody's (`/player/<nickname>-<tag>`). A head (who and since when) and, unless the member hides them, their games.
// The profile is the database's (`@pbgo/core/server/profiles`), the games are the recorded ones (`member-games.ts`). The demo account is in no database: its profile is made up here.

/** A member's level and the experience toward the next one. The platform stores none yet (no column), so it is null for a real member and only the demo account has one; the head draws what it is given. */
export type ProfileLevel = { level: number; xp: number; xpForNext: number }

/** What the top of a profile says. */
export type ProfileHead = {
  nickname: string
  /** Null for a member whose profile cannot be read (the profiles are not there yet): their name stands alone. */
  tag: number | null
  avatarUrl: string | null
  /** When the account was made, an ISO date; null when it is not known. */
  memberSince: string | null
  /** The member chose to show no games, no records and no ranks to the others (`pbgo_hide_history`). */
  hideHistory: boolean
  /** What they say of themselves, to every visitor: pronouns, country, favourite games, bio. Empty fields are for the page to leave out. */
  details: ProfileDetails
  /** Their level: a badge with the number to every visitor, the experience gauge to the member alone. Null when not known: nothing is drawn. */
  level: ProfileLevel | null
}

const headOf = (record: ProfileWithDetails): ProfileHead => ({ nickname: record.nickname, tag: record.tag, avatarUrl: record.avatarUrl, memberSince: record.createdAt, hideHistory: record.hideHistory, details: record.details, level: null })

/** What the demo account of development says of itself: made up, like its profile, so that a page with everything filled in can be looked at. Games the hub's catalog lists, so that their covers come from it. */
const DEMO_DETAILS: ProfileDetails = { pronouns: "they/them", country: "FR", city: { name: "Lyon", country: "FR" }, favoriteGames: ["courtisans", "flip-7", "hanabi"], bio: "A made-up member, for the development browser.\nNothing here is kept." }

/**
 * The head of a signed-in member's own profile: the profile they have (made on the spot if missing), else their account's name and picture with no tag (migration not applied, or unreadable: the cause is in the log). Read once per request.
 */
export const ownProfileHead = cache(async (account: Account): Promise<ProfileHead> => {
  const fallback: ProfileHead = { nickname: account.nickname, tag: null, avatarUrl: account.avatarUrl, memberSince: account.createdAt, hideHistory: account.preferences.hideHistory, details: noProfileDetails(), level: null }
  if (isDemoAccount(account)) return { ...fallback, tag: DEMO_TAG, details: DEMO_DETAILS, level: { level: 12, xp: 640, xpForNext: 1000 } }
  try {
    const record = await ensureProfile(account)
    return record ? headOf({ ...record, details: await readProfileDetails(account.id) }) : fallback
  } catch (error) {
    console.error("The profile of a member could not be read", error instanceof Error ? error.message : error)
    return fallback
  }
})

/** The handle that names a member's own profile, null while it has no tag. */
export const handleOfHead = (head: ProfileHead): Handle | null => (head.tag === null ? null : { nickname: head.nickname, tag: head.tag })

/** A profile as a page draws it. */
export type ProfilePage = {
  head: ProfileHead
  /** The visitor is looking at their own profile: they see everything, hidden or not, and can edit it. */
  own: boolean
  /** Their games, records and ranks; null for the profile of a member who keeps them private, as far as another visitor is concerned. */
  games: MemberGames | null
  /** What is between the visitor and the member (PLT-23), for the "Add friend" button: null for a visitor who is not signed in and for the member's own profile. A member who blocked the visitor is `none`, as far as the visitor can tell. */
  relation: FriendRelation | null
}

/** What is between a signed-in visitor and the member that owns a profile. The demo account is in no database, so it has no friends: `none`. Where the database cannot say, `none` too (the cause is in the log): the button then offers to add, and the server decides. */
async function relationTo(viewer: Account | null, ownerId: string): Promise<FriendRelation | null> {
  if (!viewer) return null
  if (isDemoAccount(viewer)) return "none"
  try {
    return await readRelation(viewer.id, ownerId)
  } catch (error) {
    console.error("What is between a visitor and a member could not be read", error instanceof Error ? error.message : error)
    return "none"
  }
}

const sameHandle = (a: Handle, b: Handle): boolean => a.nickname.toLowerCase() === b.nickname.toLowerCase() && a.tag === b.tag

/**
 * The profile that goes by this handle, as `viewer` sees it, or null (the hub's 404). A member who hides their games shows none to another visitor: `games` is null and the database is not asked for them. The member sees everything. At most `limit` games are listed. Throws what the database says.
 */
export async function profilePage(handle: Handle, viewer: Account | null, limit: number): Promise<ProfilePage | null> {
  if (viewer && isDemoAccount(viewer)) {
    const head = await ownProfileHead(viewer)
    if (head.tag !== null && sameHandle(handle, { nickname: head.nickname, tag: head.tag })) return { head, own: true, games: await memberGames(viewer, limit), relation: null }
  }
  const record = await readProfileByHandle(handle)
  if (!record) return null
  const { own, showGames } = profileViewOf(record, viewer)
  const [games, relation] = await Promise.all([showGames ? memberGames({ id: record.userId }, limit) : null, own ? null : relationTo(viewer, record.userId)])
  return { head: headOf(record), own, games, relation }
}
