import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { supabaseAuthConfig } from "./config"
import { isOnHold } from "./deletion"

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
  const claims = data?.claims
  if (!claims) return { response, signedIn: false }
  if (!isOnHold(claims.app_metadata)) return { response, signedIn: true }
  // The claims say the account is on hold (waiting to be deleted, PLT-36), and they are as old as the token: a member who has just kept their account would be sent away until it is renewed. Only then is the Auth server asked, so an account
  // that is not on hold costs nothing more. An account on hold is not signed in: its pages send it to the sign-in, which offers to keep it or to delete it now
  const { data: fresh } = await supabase.auth.getUser()
  return { response, signedIn: Boolean(fresh.user) && !isOnHold(fresh.user?.app_metadata) }
}

/**
 * Whether the cookies of a request hold a Supabase session: `sb-<project>-auth-token`, or its pieces `sb-<project>-auth-token.0`, `.1`… (a long session is cut). `sb-<project>-auth-token-code-verifier`, the secret that a sign-in
 * leaves in the browser, is not one. A visitor with none is not signed in, and the front page is served to them without asking Supabase anything.
 */
export function hasSessionCookie(names: Iterable<string>): boolean {
  for (const name of names) if (/^sb-.+-auth-token(?:\.\d+)?$/.test(name)) return true
  return false
}
