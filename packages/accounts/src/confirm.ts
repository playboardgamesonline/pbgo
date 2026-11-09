// The link in the confirmation e-mail (PLT-117): `/auth/confirm?token_hash=…&type=email&next=…`. What it asks for, where it sends the visitor, and the call that spends the token. The token proves the e-mail address is the
// visitor's and signs them in, so it is read once, on the server, and never reaches a page: the route verifies it and redirects, and nothing here logs it. Pure but for the call it is given, so that the route stays a few lines
// and the tests read the decisions (docs/accounts.md).

import { AFTER_SIGN_IN, safeNext } from "./redirect"

/**
 * The kinds of link this route spends: `email`, which the template of the e-mail writes (`type=email`, the one Supabase's own guide for a server-side confirm route uses), and `signup`, the same confirmation under its older name.
 * Nothing else is a sign-up's: a recovery link (`recovery`), an invitation, a magic link or the confirmation of a new address would sign a visitor in on a page that does not know why, so they are refused here.
 */
export const CONFIRM_TYPES = ["email", "signup"] as const

export type ConfirmType = (typeof CONFIRM_TYPES)[number]

/** What the link asks for: the hashed token Supabase Auth writes in `{{ .TokenHash }}` and the kind of link. */
export type ConfirmRequest = { tokenHash: string; type: ConfirmType }

/** The shape of a hashed token: letters, digits, `-` and `_` (a prefix such as `pkce_` is one), and not long. A value that is not one never leaves for Supabase Auth. */
const TOKEN_HASH = /^[A-Za-z0-9_-]{16,256}$/

/** What the link asks for, or null when it is not a sign-up's confirmation link. */
export function confirmRequestOf(params: { get(name: string): string | null }): ConfirmRequest | null {
  const tokenHash = params.get("token_hash") ?? ""
  const type = CONFIRM_TYPES.find((known) => known === params.get("type"))
  return type !== undefined && TOKEN_HASH.test(tokenHash) ? { tokenHash, type } : null
}

/**
 * The page to land on: a path of this site (`safeNext`), as in every way back from a sign-in. The e-mail may write the address that the sign-up gave Supabase Auth as its redirect URL (`&next={{ .RedirectTo }}`), which is the
 * page the visitor came from on this site, whole: its path is taken when it is of `origin`, the site, and `/me` is when it is not (an address of another site is nowhere to send a visitor, signed in).
 */
export function confirmNext(value: string | null, origin: string): string {
  if (value && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      return url.origin === origin ? safeNext(url.pathname + url.search + url.hash) : AFTER_SIGN_IN
    } catch {
      return AFTER_SIGN_IN
    }
  }
  return safeNext(value)
}

/** Where a link that did not work leads: the sign-up, which says so (`?error=confirm`) and offers a new code, with the way back kept. The token is not in it. */
export function confirmFailedPath(next: string): string {
  return `/signup?error=confirm&next=${encodeURIComponent(next)}`
}

/** What the route needs of the Supabase client: the call that spends a token. */
export type TokenVerifier = {
  auth: {
    verifyOtp(params: { token_hash: string; type: ConfirmType }): PromiseLike<{ data: { user: unknown; session: unknown }; error: unknown }>
  }
}

/**
 * Spends the token: Supabase Auth checks it, confirms the address and answers with a session, which its client has written to the cookies of the response by then. False when it did not work, whatever the reason (a link that
 * expired, was spent already, was altered, or an Auth server that did not answer): the visitor is told that the link did not work, and not more, and nothing is logged, since the request holds a secret.
 */
export async function confirmEmail(supabase: TokenVerifier, request: ConfirmRequest): Promise<boolean> {
  return (await confirmEmailSession(supabase, request)) !== null
}

/** Like `confirmEmail`, with the access token of the session it made (what the route needs to tell whether the second step of the account is still to pass), or null when it did not work. */
export async function confirmEmailSession(supabase: TokenVerifier, request: ConfirmRequest): Promise<{ accessToken: string | null } | null> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: request.tokenHash, type: request.type })
    if (error || !data.user || !data.session) return null
    const token = (data.session as { access_token?: unknown }).access_token
    return { accessToken: typeof token === "string" ? token : null }
  } catch {
    return null
  }
}
