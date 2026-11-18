import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import type { PartyAnswer } from "../../../../../lib/party"
import { ApiError, handle } from "../../../../../server/api"
import { readPartyTable } from "../../../../../server/party"
import { rateLimit } from "../../../../../server/rate-limit"

/**
 * `GET /api/hub/groups/table`: the table that the leader of the signed-in member's group opened for the group (PLT-141), `{ table }` with the game and the code, where it stands (`lobby`, or `starting` once its ready check is on), the seats and how many are taken, whether the member sits at it,
 * whether they are the leader who opened it, and how long it has waited; `{ table: null }` when the member is in no group or the leader has none. The leader's home waits on it, and every member's tab asks for it every few seconds while the member is in a group (`PartySync`), to sit down at it
 * by itself with the game's own join route, which a server cannot do for them: a seat is the secret of their browser's cookie. The code goes to the people of that group only: the group is read from the database for the account that asks. 401 when not signed in, 429 over the limit (`partyRead`).
 * The demo account of development is in no database: its group is made up by the browser, so it has no table. Never cached.
 */
export const getPartyTable = handle(async (request: Request): Promise<PartyAnswer> => {
  await rateLimit(null, request, "partyRead")
  const account = await getAccount()
  if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
  if (isDemoAccount(account)) return { table: null }
  return { table: await readPartyTable(account.id) }
})
