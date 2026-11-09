import "server-only"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import type { Account } from "@pbgo/accounts"
import { ApiError } from "./api"

export type ProfileInput = { nickname?: unknown }

/** Who sits down at a table: the name the others see and, for an account, its picture. */
export type Profile = { nickname: string; avatarUrl?: string }

/** The longest nickname, in characters as a person counts them (an emoji is one). */
const NICKNAME_MAX = 20

/** The picture of an account is drawn by the others at the table, so it is an `https` address of a sensible length: the metadata of an account is edited by its owner, and the server keeps no other kind of address. */
const picture = (url: string | null): string | null => (url && url.length <= 2048 && /^https:\/\//i.test(url) ? url : null)

export function validateProfile(input: ProfileInput): { nickname: string } {
  const nickname = typeof input.nickname === "string" ? input.nickname.trim().slice(0, NICKNAME_MAX) : ""
  if (nickname.length < 1) throw new ApiError("INVALID_NICKNAME")
  return { nickname }
}

/**
 * Who sits down, from what the request says and who is signed in. A signed-in visitor sits down as their account: the name and the picture their provider gives, taken here on the server and never
 * from the request, so that nobody can sit under another name or with a picture of their choice. A guest sits down under the nickname they typed (`validateProfile`).
 */
export function profileOf(account: Pick<Account, "nickname" | "avatarUrl"> | null, input: ProfileInput): Profile {
  if (!account) return validateProfile(input)
  const nickname = Array.from(account.nickname.trim()).slice(0, NICKNAME_MAX).join("")
  const avatarUrl = picture(account.avatarUrl)
  return { nickname: nickname || "Player", ...(avatarUrl ? { avatarUrl } : {}) }
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
  return { profile: profileOf(account, input), ...actorOf(account) }
}

/** The visitor who makes the request, for a route that seats nobody (the host's options and start): no nickname is asked of a guest there. */
export async function resolveActor(): Promise<Actor> {
  return actorOf(await getAccount())
}
