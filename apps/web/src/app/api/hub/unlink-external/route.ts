import type { NextRequest } from "next/server"
import { externalUnlink, isExternalProvider } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { createAdminClient, externalDeps, getAccount } from "@pbgo/accounts/server"
import { ApiError, handle, readJson } from "@pbgo/core/server/api"
import { rateLimit } from "@pbgo/core/server/rate-limit"

// A member taking an account at an external provider off theirs: it reads the session and writes the database, so never static
export const dynamic = "force-dynamic"

/**
 * `POST /api/hub/unlink-external` (`{ "provider": "steam" }`): the signed-in member takes the account they linked at an external provider (Steam: PLT-133) off theirs. It is not a game's route. The member is the one the session
 * says (`getAccount`), never one the body names, and a visitor who is not signed in gets a 401. The server checks that they keep another way in (`externalUnlink`): when they would not, `LAST_WAY_IN` (409), and nothing is changed. A browser
 * sends `Origin` with every POST it makes, and it has to be this site's, so that a page of another site cannot have a member's browser unlink their account. The demo account of development is in no database: it is told as done and
 * nothing is written. What went wrong in the database or in Supabase Auth is logged as the step it failed at, never as what was said, and the member is told that it did not work (`UNLINK_FAILED`, 500).
 */
export const POST = handle(async (request: NextRequest) => {
  if (request.headers.get("origin") !== request.nextUrl.origin) throw new ApiError("FORBIDDEN", 403)
  await rateLimit(null, request, "externalUnlink")
  const account = await getAccount()
  if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
  const { provider } = await readJson<{ provider?: unknown }>(request)
  if (typeof provider !== "string" || !isExternalProvider(provider)) throw new ApiError("INVALID_REQUEST")
  if (isDemoAccount(account)) return { unlinked: true }
  const admin = createAdminClient()
  if (!admin) throw new ApiError("UNLINK_FAILED", 500)
  const result = await externalUnlink(provider, account.id, externalDeps(admin))
  if (result.ok) return { unlinked: true }
  if (result.reason === "last-way-in") throw new ApiError("LAST_WAY_IN", 409)
  console.warn(`[api/hub/unlink-external] failed: ${result.step}`)
  throw new ApiError("UNLINK_FAILED", 500)
})
