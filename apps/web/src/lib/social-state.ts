import "server-only"
import type { Account } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import type { SocialState } from "@pbgo/core/lib/friends"
import { readSocial, stateOf } from "@pbgo/core/server/friends"
import { friendsDeps } from "./friends-deps"

/**
 * The social state of a signed-in member, read on the server for the pages that are drawn per request (`/me/friends`, the Data & Privacy settings), so that they have their first paint with the friends and not an empty list that fills in: the browser then keeps it
 * fresh (`social-store.ts`). Null for the demo account of development (its friends are made up by the browser) and where the database cannot be read (the cause is in the log): the page then starts from nothing and the browser reads it.
 */
export async function socialOf(account: Pick<Account, "id">): Promise<SocialState | null> {
  if (isDemoAccount(account)) return null
  try {
    const [record, names] = await Promise.all([readSocial(account.id), friendsDeps.gameNames().catch(() => new Map<string, string>())])
    return stateOf(record, names)
  } catch (error) {
    console.error("The friends of a member could not be read", error instanceof Error ? error.message : error)
    return null
  }
}
