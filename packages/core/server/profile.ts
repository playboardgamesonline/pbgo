import "server-only"
import { ApiError } from "./api"

export type ProfileInput = { nickname?: unknown }

export function validateProfile(input: ProfileInput): { nickname: string } {
  const nickname = typeof input.nickname === "string" ? input.nickname.trim().slice(0, 20) : ""
  if (nickname.length < 1) throw new ApiError("INVALID_NICKNAME")
  return { nickname }
}
