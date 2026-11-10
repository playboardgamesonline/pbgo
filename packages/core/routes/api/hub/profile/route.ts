import { checkNickname, tagOfRequest } from "@pbgo/accounts"
import { DEMO_TAG, isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { ApiError, assertSameOrigin, handle, readJson } from "../../../../server/api"
import { ensureProfile, profilesNotApplied, saveProfile, type ProfileChange } from "../../../../server/profiles"
import { rateLimit } from "../../../../server/rate-limit"

/**
 * `POST /api/hub/profile`: a signed-in member changes their nickname and tag (`{ "nickname": "Alex", "tag": 42 }`, PLT-39). The request must come from this site. Both values are checked here (`checkNickname`, `checkTag`) and by the database, which keeps the pair in one statement (`set_profile`). 409 `PROFILE_TAKEN` when another member has the pair (case ignored). The demo account writes nothing.
 */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request)
  await rateLimit(null, request, "profile")
  const account = await getAccount()
  if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
  const body = await readJson<{ nickname?: unknown; tag?: unknown }>(request)
  const checked = typeof body.nickname === "string" ? checkNickname(body.nickname) : null
  const tag = tagOfRequest(body.tag)
  if (!checked?.ok || tag === null) throw new ApiError("PROFILE_INVALID")
  const handleOfMember = { nickname: checked.nickname, tag }
  if (isDemoAccount(account)) return { saved: true, ...handleOfMember }

  const change = async (): Promise<ProfileChange> => {
    try {
      return await saveProfile(account.id, handleOfMember)
    } catch (error) {
      // A database that has not got the profiles yet cannot keep them: the member is told it is not available, not that something broke
      if (profilesNotApplied(error)) throw new ApiError("PROFILE_UNAVAILABLE", 503)
      throw error
    }
  }
  let answer = await change()
  // An account whose profile was never made (the database makes it with the account, so this is the rare case) gets it now, and the change is asked again
  if (answer === "missing" && (await ensureProfile(account))) answer = await change()
  if (answer === "taken") throw new ApiError("PROFILE_TAKEN", 409)
  if (answer === "invalid") throw new ApiError("PROFILE_INVALID")
  if (answer === "missing") throw new ApiError("PROFILE_UNAVAILABLE", 503)
  return { saved: true, ...handleOfMember }
})

/**
 * `GET /api/hub/profile`: the signed-in member's own handle, `{ "nickname": "Alex", "tag": 42 }`, for the account menu and the panel head (the session has no tag). 401 when not signed in. `"tag": null` where the database has no profile or cannot be read. Never cached.
 */
export const GET = handle(async (request: Request) => {
  await rateLimit(null, request, "profileRead")
  const account = await getAccount()
  if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
  if (isDemoAccount(account)) return { nickname: account.nickname, tag: DEMO_TAG }
  try {
    const record = await ensureProfile(account)
    return record ? { nickname: record.nickname, tag: record.tag } : { nickname: account.nickname, tag: null }
  } catch (error) {
    console.error("The profile of a member could not be read for their menu", error instanceof Error ? error.message : error)
    return { nickname: account.nickname, tag: null }
  }
})
