import "server-only"

import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { accountOf, type Account } from "./account"
import { supabaseAuthConfig } from "./config"
import { DEMO_ACCOUNT, DEMO_COOKIE, demoAllowed } from "./demo"

// The accounts on the server: the Supabase client of a request (it reads the session from the cookies and writes a refreshed one back), and who is
// signed in. A page that shows an account is rendered per request, so it is not static: the hub's pages that stay static ask the browser instead
// (`./client`).

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

/** The account of a page that is for a signed-in visitor alone: a visitor who is not signed in is sent to `/login` and brought back to `path`. */
export async function requireAccount(path: string): Promise<Account> {
  const account = await getAccount()
  if (!account) redirect(`/login?next=${encodeURIComponent(path)}`)
  return account
}
