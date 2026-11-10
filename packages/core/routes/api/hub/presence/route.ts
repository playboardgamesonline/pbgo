import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { ApiError, handle } from "../../../../server/api"
import { touchMember } from "../../../../server/presence"
import { rateLimit } from "../../../../server/rate-limit"
import { activeTable, hasTableToWatch, readMemberTables } from "../../../../server/tables"

/** Where the member should be, and whether to ask again soon: the table that is in its ready check or being played (the game and its code, enough to build the address of its board), and whether a table may begin any moment. Never throws: the beat is for presence. */
async function whereToBe(userId: string): Promise<{ table: { game: string; code: string } | null; watching: boolean }> {
  try {
    const tables = await readMemberTables(userId)
    const table = activeTable(tables)
    return { table: table ? { game: table.game, code: table.code } : null, watching: hasTableToWatch(tables) }
  } catch (error) {
    console.error("The tables of a member could not be read", error instanceof Error ? error.message : error)
    return { table: null, watching: false }
  }
}

/**
 * `POST /api/hub/presence`: the beat of a signed-in member who has the site open (`PresenceBeat`, about every 45 s from a tab that is in view). The players online count them for two minutes after
 * the last one (`member_presence`, migration 0005). It is not a game's route: the member is asked of Supabase Auth (`getAccount`), and a visitor who is not signed in gets a 401 and is never counted.
 * The demo account of development is in no database, so its beat writes nothing.
 *
 * The answer says where the member should be (PLT-120): `table` is the game and the code of the table they sit at that is in its ready check or being played, which the page takes them to from any page of the hub (a player who is
 * playing is taken to their game), and `watching` that they have a table that may begin any moment (a lobby, or a ready check), which makes the browser beat sooner. Both are best effort: a project where migration 0013 is
 * not applied yet, or a database that cannot answer, gives `table: null` and the beat still counts the member.
 */
export const POST = handle(async (request: Request) => {
  await rateLimit(null, request, "presence")
  const account = await getAccount()
  if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
  if (isDemoAccount(account)) return { ok: true, table: null, watching: false }
  const [, where] = await Promise.all([touchMember(account.id), whereToBe(account.id)])
  return { ok: true, ...where }
})
