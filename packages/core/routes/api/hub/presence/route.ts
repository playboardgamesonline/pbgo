import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { ApiError, handle } from "../../../../server/api"
import { touchMember } from "../../../../server/presence"
import { rateLimit } from "../../../../server/rate-limit"

/**
 * `POST /api/hub/presence`: the beat of a signed-in member who has the site open (`PresenceBeat`, about every 45 s from a tab that is in view). The players online count them for two minutes after
 * the last one (`member_presence`, migration 0005). It is not a game's route: the member is asked of Supabase Auth (`getAccount`), and a visitor who is not signed in gets a 401 and is never counted.
 * The demo account of development is in no database, so its beat writes nothing.
 */
export const POST = handle(async (request: Request) => {
  await rateLimit(null, request, "presence")
  const account = await getAccount()
  if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
  if (!isDemoAccount(account)) await touchMember(account.id)
  return { ok: true }
})
