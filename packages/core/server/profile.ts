import "server-only"
import { getAccount } from "@pbgo/accounts/server"
import type { Account } from "@pbgo/accounts"
import { ApiError } from "./api"

export type ProfileInput = { nickname?: unknown }

/** Who sits down at a table: the name the others see and, for an account, its picture. */
export type Profile = { nickname: string; avatarUrl?: string }

/** The longest nickname, in characters as a person counts them (an emoji is one). */
const NICKNAME_MAX = 20

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
  return { nickname: nickname || "Player", ...(account.avatarUrl ? { avatarUrl: account.avatarUrl } : {}) }
}

/** `profileOf` for the request being served: the signed-in visitor is asked of Supabase Auth (`getAccount`), a visitor with no session costs no call. */
export async function resolveProfile(input: ProfileInput): Promise<Profile> {
  return profileOf(await getAccount(), input)
}
