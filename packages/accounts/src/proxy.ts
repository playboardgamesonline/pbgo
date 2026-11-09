import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { supabaseAuthConfig } from "./config"
import { failureOf } from "./signup"

// The session refresh: a session's access token lives an hour, and only a response can write the cookie that renews it, which a Server Component
// cannot. The app's `proxy.ts` calls this for the pages of a signed-in visitor, so that they render with a session that is still good, and the
// browser gets the renewed cookie. Nothing else runs in it: no redirect, no rule (a page decides for itself, `requireAccount`).

/** What the proxy knows after the session is renewed: the response to send on (it carries the renewed cookies) and whether the visitor is signed in. */
export type SessionUpdate = { response: NextResponse; signedIn: boolean }

/**
 * Lets the request through, with the session renewed when it had to be, and says whether the visitor is signed in. What it asks is the claims of the token, which it checks against the project's public key and not against the
 * Auth server (the projects sign with asymmetric keys), so a token whose session was ended on the server (the member signed out their other devices, or turned on the second step, which ends every session that has not passed it)
 * still reads as signed in until it expires, up to an hour. `confirm` asks the Auth server too, for the one page that sends a signed-in visitor somewhere that sends a visitor who is not back (the front page): a session the Auth
 * server does not know is then no session, and its cookies are taken off the device, here, where a response can always write them (a page cannot be trusted to: it went on bouncing between `/` and `/home` for as long as the token
 * lived). An answer that is not "no such session" (the Auth server is down, or slow) leaves the cookies alone.
 */
export async function updateSession(request: NextRequest, { confirm = false }: { confirm?: boolean } = {}): Promise<SessionUpdate> {
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
  if (!data?.claims) return { response, signedIn: false }
  if (!confirm) return { response, signedIn: true }

  const { data: confirmed, error } = await supabase.auth.getUser()
  if (confirmed.user) return { response, signedIn: true }
  // 400 (`AuthSessionMissingError`, which the client library makes of the answer), 401 (the token), 403 (`session_not_found`) and 404 (`user_not_found`) are the Auth server saying that it knows no such session; anything else did not answer the question
  const { status, name } = failureOf(error)
  if (name === "AuthSessionMissingError" || [401, 403, 404].includes(status ?? 0)) {
    for (const { name: cookie } of request.cookies.getAll()) if (hasSessionCookie([cookie])) response.cookies.delete(cookie)
  }
  return { response, signedIn: false }
}

/**
 * Whether the cookies of a request hold a Supabase session: `sb-<project>-auth-token`, or its pieces `sb-<project>-auth-token.0`, `.1`… (a long session is cut). `sb-<project>-auth-token-code-verifier`, the secret that a sign-in
 * leaves in the browser, is not one. A visitor with none is not signed in, and the front page is served to them without asking Supabase anything.
 */
export function hasSessionCookie(names: Iterable<string>): boolean {
  for (const name of names) if (/^sb-.+-auth-token(?:\.\d+)?$/.test(name)) return true
  return false
}
