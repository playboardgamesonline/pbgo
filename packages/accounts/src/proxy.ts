import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { supabaseAuthConfig } from "./config"

// The session refresh: a session's access token lives an hour, and only a response can write the cookie that renews it, which a Server Component
// cannot. The app's `proxy.ts` calls this for the pages of a signed-in visitor, so that they render with a session that is still good, and the
// browser gets the renewed cookie. Nothing else runs in it: no redirect, no rule (a page decides for itself, `requireAccount`).

/** What the proxy knows after the session is renewed: the response to send on (it carries the renewed cookies) and whether the visitor is signed in. */
export type SessionUpdate = { response: NextResponse; signedIn: boolean }

/** Lets the request through, with the session renewed when it had to be, and says whether the visitor is signed in. */
export async function updateSession(request: NextRequest): Promise<SessionUpdate> {
  let response = NextResponse.next({ request })
  const config = supabaseAuthConfig()
  if (!config) return { response, signedIn: false }

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of list) response.cookies.set(name, value, options)
      },
    },
  })
  // Asking for the claims is what renews an expired token; nothing may run between the client and this
  const { data } = await supabase.auth.getClaims()
  return { response, signedIn: Boolean(data?.claims) }
}
