import "server-only"

import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { accountOf, type Account } from "./account"
import { supabaseAuthConfig } from "./config"
import { DEMO_ACCOUNT, DEMO_COOKIE, DEMO_HELD, demoAllowed, heldDemoAccount } from "./demo"

// The accounts on the server: the Supabase client of a request (it reads the session from the cookies and writes a refreshed one back), and who is
// signed in. A page that shows an account is rendered per request, so it is not static: the hub's pages that stay static ask the browser instead
// (`./client`).

/** Which providers the project has switched on, for the sign-in page (`./providers`). */
export { enabledProviders } from "./providers"

/** The Supabase client of this request, or null when the project is not set. */
export async function createAuthClient(): Promise<SupabaseClient | null> {
  const config = supabaseAuthConfig()
  if (!config) return null
  const store = await cookies()
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          // A Server Component cannot write cookies: the proxy has refreshed the session before it renders (`./proxy`)
        }
      },
    },
  })
}

/** Which demo account of development is asked for (a development server alone honours it): the one in use, the one on hold (`/auth/demo?held=1`), or none. */
async function demoAsked(): Promise<Account | null> {
  if (!demoAllowed()) return null
  const value = (await cookies()).get(DEMO_COOKIE)?.value
  return value === "1" ? DEMO_ACCOUNT : value === DEMO_HELD ? heldDemoAccount() : null
}

/** The account of the session, on hold or not (`deletionAt`): the user is asked of the Auth server rather than read from the cookie, which anyone can write. Once per request (`cache`). */
const sessionAccount = cache(async (): Promise<Account | null> => {
  const supabase = await createAuthClient()
  if (supabase) {
    const { data } = await supabase.auth.getUser()
    if (data.user) return accountOf(data.user)
  }
  return demoAsked()
})

/**
 * Who is signed in. The user is asked of the Auth server rather than read from the cookie, which anyone can write: only what the server confirms is an
 * account. Null for a visitor who is not signed in, **and for an account that is ON HOLD, waiting to be deleted** (PLT-36): everything that asks who is signed in
 * treats it as a visitor, so that it takes part in nothing new (no new seat, no presence, no new preference), and the code that comes later cannot forget to. Asked once per request, however many components ask (`cache`).
 */
export const getAccount = cache(async (): Promise<Account | null> => {
  const account = await sessionAccount()
  return account && !account.deletionAt ? account : null
})

/** The account of the session when it is ON HOLD, else null: what the sign-in page and the deletion route need, to offer to keep it or to delete it now. */
export const getHeldAccount = cache(async (): Promise<Account | null> => {
  const account = await sessionAccount()
  return account?.deletionAt ? account : null
})

/** The account of a page that is for a signed-in visitor alone: a visitor who is not signed in is sent to `/login` and brought back to `path`. */
export async function requireAccount(path: string): Promise<Account> {
  const account = await getAccount()
  if (!account) redirect(`/login?next=${encodeURIComponent(path)}`)
  return account
}
