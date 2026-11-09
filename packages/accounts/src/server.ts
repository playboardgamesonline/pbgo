import "server-only"

import { createServerClient } from "@supabase/ssr"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { accountOf, type Account } from "./account"
import { supabaseAuthConfig } from "./config"
import { DEMO_ACCOUNT, DEMO_COOKIE, demoAllowed } from "./demo"
import type { ExternalDeps } from "./external"

// The accounts on the server: the Supabase client of a request (it reads the session from the cookies and writes a refreshed one back), and who is
// signed in. A page that shows an account is rendered per request, so it is not static: the hub's pages that stay static ask the browser instead
// (`./client`).

/** Which providers the project has switched on, for the settings that link them, and what the sign-in offers (`./providers`). */
export { enabledProviders, externalProvidersOn, signInProviders } from "./providers"

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

/**
 * The Supabase client of the secret key, which can do anything and ignores the row level security: it exists on the server alone, for the calls that make or sign in a member who has no e-mail address (`./external`), and is not
 * given a session. Null when the project or its key is not set.
 */
export function createAdminClient(): SupabaseClient | null {
  const config = supabaseAuthConfig()
  const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim()
  return config && secret ? createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null
}

/** What `externalSignIn` is given, made of a client of the secret key: Supabase's admin API and the table `external_identities` (migration 0010). */
export function externalDeps(admin: SupabaseClient): ExternalDeps {
  const api = admin.auth.admin
  return {
    admin: {
      createUser: (attributes) => api.createUser(attributes),
      getUserById: (id) => api.getUserById(id),
      updateUserById: (id, attributes) => api.updateUserById(id, attributes),
      deleteUser: (id) => api.deleteUser(id),
      generateLink: async (email) => {
        const { data, error } = await api.generateLink({ type: "magiclink", email })
        return { data: { hashedToken: data?.properties?.hashed_token ?? null }, error }
      },
    },
    store: {
      async userOf(provider, subject) {
        const { data, error } = await admin.from("external_identities").select("user_id").eq("provider", provider).eq("subject", subject).maybeSingle()
        if (error) throw new Error(error.message)
        return typeof data?.user_id === "string" ? data.user_id : null
      },
      async add(provider, subject, userId) {
        const { error } = await admin.from("external_identities").insert({ provider, subject, user_id: userId })
        if (!error) return "added"
        // 23505: the identity is held already, by a sign-in that came a moment before
        if (error.code === "23505") return "taken"
        throw new Error(error.message)
      },
    },
  }
}
