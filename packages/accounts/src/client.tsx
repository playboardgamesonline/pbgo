"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { accountOf, type Account, type Provider } from "./account"
import { supabaseAuthConfig } from "./config"
import { DEMO_ACCOUNT, DEMO_COOKIE, demoAllowed } from "./demo"
import { safeNext } from "./redirect"

// The accounts in the browser: who is signed in (for the navbar, which is on static pages and so cannot ask the server), and the way to start a
// sign-in. The session lives in cookies (`@supabase/ssr`), which the server reads too, so the two always agree.

let client: SupabaseClient | null | undefined

/** The browser's Supabase client, made once; null when the project is not set. */
function browserClient(): SupabaseClient | null {
  if (client !== undefined) return client
  const config = supabaseAuthConfig()
  client = config ? createBrowserClient(config.url, config.key) : null
  return client
}

/** Who is signed in, as far as the browser knows: not asked yet, nobody, or an account. */
export type AccountState = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; account: Account }

const signedOut: AccountState = { status: "signed-out" }

/** The demo account of development, when its cookie is there (`/auth/demo`). A production build holds none of this. */
function demoState(): AccountState | null {
  if (!demoAllowed()) return null
  return document.cookie.split("; ").includes(`${DEMO_COOKIE}=1`) ? { status: "signed-in", account: DEMO_ACCOUNT } : null
}

/**
 * Who is signed in. `loading` until the browser has read its session (the server renders every page as if nobody were signed in, so the first
 * paint is the same everywhere and the pages can stay static), then `signed-out` or `signed-in`, and it follows a sign-in or a sign-out made in
 * this or another tab.
 */
export function useAccount(): AccountState {
  const [state, setState] = useState<AccountState>({ status: "loading" })

  useEffect(() => {
    const demo = demoState()
    const supabase = browserClient()
    if (!supabase) {
      setState(demo ?? signedOut)
      return
    }
    let active = true
    const read = (user: Parameters<typeof accountOf>[0] | null | undefined): AccountState =>
      user ? { status: "signed-in", account: accountOf(user) } : (demo ?? signedOut)
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState(read(data.session?.user))
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState(read(session?.user)))
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}

/**
 * Starts a sign-in with a provider: the browser leaves for the provider, which sends the visitor back to `/auth/callback`, which sends them on to
 * `next`. Resolves with a sentence for the visitor when it cannot start (and with null when the browser is on its way).
 */
export async function signInWith(provider: Provider, next: string): Promise<string | null> {
  const supabase = browserClient()
  if (!supabase) return "Sign-in is not available here."
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
  return error ? "Sign-in did not start. Try again." : null
}
