import "server-only"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import type { Account } from "@pbgo/accounts"
import { ApiError } from "./api"
import { ensureProfile, pictureUrl, type ProfileRecord } from "./profiles"

export type ProfileInput = { nickname?: unknown }

/** Who sits down at a table: the name the others see and, for an account, its picture and the tag that goes with its name (`Alex#0042`: the handle that leads to its profile, PLT-39). A guest has a nickname alone. */
export type Profile = { nickname: string; avatarUrl?: string; tag?: number }

/** The longest nickname, in characters as a person counts them (an emoji is one). */
const NICKNAME_MAX = 20

/**
 * A guest's nickname is what they typed, cut to 20 characters, with no `#`. Only a member has a tag, and a guest must not be able to write one to pass for a member.
 */
export function validateProfile(input: ProfileInput): { nickname: string } {
  const nickname = typeof input.nickname === "string" ? input.nickname.replace(/#/g, "").trim().slice(0, NICKNAME_MAX) : ""
  if (nickname.length < 1) throw new ApiError("INVALID_NICKNAME")
  return { nickname }
}

/**
 * Who sits down, from what the request says and who is signed in. A signed-in visitor sits down as their account, taken here on the server and never from the request, so that nobody can sit under another name or with a picture of their choice:
 * as their profile when they have one (`member`: the nickname and the tag that are theirs and no other member's, and the picture their provider gives), else as the name and the picture their provider gives, with no tag (a project where the profiles are not
 * there yet). A guest sits down under the nickname they typed (`validateProfile`), with no tag.
 */
export function profileOf(account: Pick<Account, "nickname" | "avatarUrl"> | null, input: ProfileInput, member: Pick<ProfileRecord, "nickname" | "tag" | "avatarUrl"> | null = null): Profile {
  if (!account) return validateProfile(input)
  if (member) {
    const avatarUrl = pictureUrl(member.avatarUrl)
    return { nickname: member.nickname, tag: member.tag, ...(avatarUrl ? { avatarUrl } : {}) }
  }
  const nickname = Array.from(account.nickname.trim()).slice(0, NICKNAME_MAX).join("")
  const avatarUrl = pictureUrl(account.avatarUrl)
  return { nickname: nickname || "Player", ...(avatarUrl ? { avatarUrl } : {}) }
}

/**
 * The profile of a signed-in member for their seat: made on the spot when the database has none. A database that cannot say is no reason to keep a member from sitting down: the seat is then the one their account would give, with no tag, and the
 * cause is in the log.
 */
async function memberProfile(account: Account): Promise<ProfileRecord | null> {
  try {
    return await ensureProfile(account)
  } catch (error) {
    console.error("The profile of a member could not be read for their seat", error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Who acts, as far as the table cares: `memberId` is the id of a signed-in member's account, null for a guest and for the demo account of development, which is in no database; `signedIn` is whether there is an account at all, the demo
 * account included (the check of the age tells a guest, who must sign in, from the demo account, which counts as an adult).
 */
export type Actor = { memberId: string | null; signedIn: boolean }

/** The actor an account stands for (null: a guest). */
export const actorOf = (account: Pick<Account, "id"> | null): Actor => ({ memberId: account && !isDemoAccount(account) ? account.id : null, signedIn: account !== null })

/** Who sits down, and the account they sit down as (`Actor`). */
export type Seat = { profile: Profile } & Actor

/**
 * `profileOf` for the request being served, and who the visitor is: the signed-in visitor is asked of Supabase Auth (`getAccount`), a visitor with no session costs no call. The `memberId` is not part of
 * the seat that the others see: the table records it apart (`seatMember`), for the count of the players online.
 */
export async function resolveSeat(input: ProfileInput): Promise<Seat> {
  const account = await getAccount()
  return { profile: profileOf(account, input, account ? await memberProfile(account) : null), ...actorOf(account) }
}

/** The visitor who makes the request, for a route that seats nobody (the host's options and start): no nickname is asked of a guest there. */
export async function resolveActor(): Promise<Actor> {
  return actorOf(await getAccount())
}
