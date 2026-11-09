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

/**
 * Whether the cookies of a request hold a Supabase session: `sb-<project>-auth-token`, or its pieces `sb-<project>-auth-token.0`, `.1`… (a long session is cut). `sb-<project>-auth-token-code-verifier`, the secret that a sign-in
 * leaves in the browser, is not one. A visitor with none is not signed in, and the front page is served to them without asking Supabase anything.
 */
export function hasSessionCookie(names: Iterable<string>): boolean {
  for (const name of names) if (/^sb-.+-auth-token(?:\.\d+)?$/.test(name)) return true
  return false
}
