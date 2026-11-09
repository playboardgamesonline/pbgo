import "server-only"

import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { accountOf, type Account } from "./account"
import { supabaseAuthConfig } from "./config"
import { DEMO_ACCOUNT, DEMO_COOKIE, demoAllowed } from "./demo"
import { hasSessionCookie } from "./proxy"

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

/** Whether the demo account of development is asked for (a development server alone honours it). */
async function demoAsked(): Promise<boolean> {
  return demoAllowed() && (await cookies()).get(DEMO_COOKIE)?.value === "1"
}

/**
 * Who is signed in. The user is asked of the Auth server rather than read from the cookie, which anyone can write: only what the server confirms is an
 * account. Null for a visitor who is not signed in. Asked once per request, however many components ask (`cache`).
 */
export const getAccount = cache(async (): Promise<Account | null> => {
  const supabase = await createAuthClient()
  if (supabase) {
    const { data } = await supabase.auth.getUser()
    if (data.user) return accountOf(data.user)
  }
  return (await demoAsked()) ? DEMO_ACCOUNT : null
})

/**
 * Takes the session off this device: the cookies of the Supabase session go, whatever the Auth server would say about them. For an account that was just closed or deleted (PLT-36), the session ended in the database and the Auth server
 * refuses every call that carries it, so `signOut` could not be trusted to clear them; and a cookie that outlives its session would send the visitor to the member home (the proxy reads the cookie) and from there back to the sign-in.
 * Only a route handler can write cookies.
 */
export async function clearSessionCookies(): Promise<void> {
  const store = await cookies()
  for (const { name } of store.getAll()) if (hasSessionCookie([name])) store.delete(name)
}

/** The account of a page that is for a signed-in visitor alone: a visitor who is not signed in is sent to `/login` and brought back to `path`. */
export async function requireAccount(path: string): Promise<Account> {
  const account = await getAccount()
  if (!account) redirect(`/login?next=${encodeURIComponent(path)}`)
  return account
}
