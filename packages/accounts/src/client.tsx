"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { accountOf, emailOf, type Account, type Provider } from "./account"
import { supabaseAuthConfig } from "./config"
import { DEMO_ACCOUNT, DEMO_COOKIE, demoAllowed, isDemoAccount } from "./demo"
import { LANGUAGE_KEY, languageCookie, languageOf, type PlatformLanguage } from "./language"
import { safeNext } from "./redirect"
import { syncLanguage } from "./language-sync"
import { isChangingLanguage } from "./set-language"
import { codeMessage, resendOutcome, signupData, signupOutcome, type ResendOutcome, type SignupEntry, type SignupOutcome } from "./signup"

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

/**
 * Signs in with an e-mail address and a password (the email provider of Supabase Auth): the session lands in the cookies, so the page can go on to `next`.
 * Resolves with a sentence for the visitor when it fails, and with null when they are signed in. The first field is called a username, but Supabase Auth
 * knows a visitor by their address alone (`emailOf`): until the profiles exist (PLT-39) a username is told to use it.
 */
export async function signInWithPassword(identifier: string, password: string): Promise<string | null> {
  const supabase = browserClient()
  if (!supabase) return "Sign-in is not available here."
  const email = emailOf(identifier)
  if (email === null) return "Use your e-mail address for now: usernames are coming."
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (!error) {
    // This device takes the language of the account at once, so that the page it opens next, a game's perhaps, is drawn in it (`useLanguageSync` does the rest)
    const language = data.user ? languageOf(data.user) : null
    if (language) document.cookie = languageCookie(language)
    return null
  }
  if (error.code === "invalid_credentials") return "That e-mail and that password do not go together."
  // Told only to someone who typed the right password, so it gives nothing away: an account that was made and never confirmed (`signUpWithPassword`)
  if (error.code === "email_not_confirmed") return "Your e-mail address is not confirmed yet. Use the code we sent you, or create the account again to get a new one."
  return "Sign-in did not work. Try again."
}

/**
 * Creates an account with an e-mail address and a password (the email provider of Supabase Auth, with "Confirm email" on): nobody is signed in by it. An e-mail with a code and a link goes to the address, and the page asks for the
 * code (`verifySignupCode`) or the visitor follows the link (`/auth/confirm`). `entry.name` is the display name, kept in the account's metadata under the key `accountOf` reads for the nickname. `next` is where the link leads (the
 * template writes it with `{{ .RedirectTo }}`, an address of this site that the project's redirect URLs must allow), and `captchaToken` is the answer to a CAPTCHA, for the day the project asks for one (none is drawn yet). An
 * address that already has an account answers like a new one and nothing is sent: `signupOutcome` tells a stranger nothing about the addresses that are taken.
 */
export async function signUpWithPassword(entry: SignupEntry & { next: string; captchaToken?: string }): Promise<SignupOutcome> {
  const supabase = browserClient()
  if (!supabase) return { sent: false, message: "Sign-up is not available here." }
  try {
    const { error } = await supabase.auth.signUp({
      email: entry.email,
      password: entry.password,
      options: { data: signupData(entry.name), emailRedirectTo: `${window.location.origin}${safeNext(entry.next)}`, captchaToken: entry.captchaToken },
    })
    return signupOutcome(error)
  } catch (error) {
    return signupOutcome(error)
  }
}

/**
 * Spends the code of the confirmation e-mail: the address is confirmed and the visitor is signed in, the session lands in the cookies and the page can go on to `next`. Resolves with a sentence for the visitor when it fails (a
 * wrong code and an expired one are one answer: Supabase Auth does not tell them apart) and with null when they are signed in. The type is `email`, which Supabase's documentation gives for "Verify Signup One-Time Password
 * (OTP)" and for the link's `type=email` alike; `signup` is the older name of the same confirmation.
 */
export async function verifySignupCode(email: string, code: string): Promise<string | null> {
  const supabase = browserClient()
  if (!supabase) return "Sign-up is not available here."
  try {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" })
    return error ? codeMessage(error) : null
  } catch (error) {
    return codeMessage(error)
  }
}

/** Asks for another code (and another link) for an address that signed up and has not confirmed it: Supabase Auth sends one a minute. It answers the same for an address that has no account to confirm. */
export async function resendSignupCode(email: string, next: string, captchaToken?: string): Promise<ResendOutcome> {
  const supabase = browserClient()
  if (!supabase) return { status: "failed", message: "Sign-up is not available here." }
  try {
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}${safeNext(next)}`, captchaToken } })
    return resendOutcome(error)
  } catch (error) {
    return resendOutcome(error)
  }
}

/** What became of a language handed to the account: kept, not kept because nobody is signed in (a guest, the demo account), or not kept because the account could not be written. */
export type SavedLanguage = "saved" | "no-session" | "failed"

/**
 * Keeps the visitor's language on their account: Supabase Auth merges it, key by key, into the account's `user_metadata` under the one key that is ours (`LANGUAGE_KEY`) and leaves the others,
 * which the providers fill at each sign-in, as they are. It is the only writer of the language (`setLanguage` of `./set-language` calls it), so that it moves to a `profiles.locale` column
 * the day the profiles exist (PLT-13) by changing this function and `languageOf` alone. The access token keeps the metadata it was issued with until it is renewed, so nothing may read the
 * language from the claims: `useAccount` reads the session's user, which `updateUser` has just replaced.
 */
export async function saveLanguage(language: PlatformLanguage): Promise<SavedLanguage> {
  const supabase = browserClient()
  if (!supabase) return "no-session"
  const { data } = await supabase.auth.getSession()
  if (!data.session) return "no-session"
  const { error } = await supabase.auth.updateUser({ data: { [LANGUAGE_KEY]: language } })
  return error ? "failed" : "saved"
}

/**
 * The session this browser holds keeps the account's metadata as it was when the session was last renewed, an hour ago at most, so a language chosen on another device is not in it yet (the
 * claims of the token are no fresher). Asks the Auth server for the user and, when the language it holds is not the one in the session, renews the session: the renewed one carries the new
 * metadata, `useAccount` hands it to the sync and the sync writes the cookie. Nothing happens when the two agree, when nobody is signed in or the server cannot be reached, nor while a change
 * of language is on its way. Resolves with whether the session was renewed.
 */
export async function renewIfLanguageChanged(): Promise<boolean> {
  const supabase = browserClient()
  if (!supabase) return false
  const [fresh, held] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()])
  const user = fresh.data.user
  const session = held.data.session
  if (!user || !session || isChangingLanguage() || languageOf(user) === languageOf(session.user)) return false
  const { error } = await supabase.auth.refreshSession()
  return !error
}

/**
 * Keeps the device of a signed-in visitor in step with their account's language, each time the browser reads their session: on a page load, on a sign-in, on the renewal of the token and on a
 * change made in another tab. The account wins, so the cookie, which the server reads, is rewritten to its language and the page rendered again if it was in another; an account that keeps none
 * yet (its first sign-in) takes the language in use. A change made on another device is found once per page load of the hub (`renewIfLanguageChanged`: one request to the Auth server, the
 * session is renewed only when the language differs). Nothing for a guest and for the demo account. Mount it once, where `useAccount` already is (`LanguageSync` of the app); the server never
 * reads the account for this, so the pages stay static.
 */
export function useLanguageSync(): void {
  const state = useAccount()
  const router = useRouter()
  const signedIn = state.status === "signed-in" && !isDemoAccount(state.account) ? state.account.id : null
  useEffect(() => {
    if (signedIn) renewIfLanguageChanged().catch(() => {})
  }, [signedIn])
  useEffect(() => {
    syncLanguage(
      state,
      { cookies: document.cookie, languages: navigator.languages },
      {
        writeCookie: (language) => {
          document.cookie = languageCookie(language)
        },
        saveAccount: (language) => {
          saveLanguage(language).catch(() => {})
        },
        refresh: () => router.refresh(),
      },
    )
  }, [state, router])
}
