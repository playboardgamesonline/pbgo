"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { accountOf, emailOf, isExternalProvider, type Account, type AnyProvider, type Provider } from "./account"
import { supabaseAuthConfig } from "./config"
import { DEMO_ACCOUNT, DEMO_COOKIE, demoAllowed, isDemoAccount } from "./demo"
import { COUNTRY_KEY } from "./details"
import { LANGUAGE_KEY, languageCookie, languageOf, type PlatformLanguage } from "./language"
import { applyMotion, syncMotion } from "./motion"
import { NICKNAME_KEY, PREFERENCE_KEYS, type PreferenceName, type Preferences } from "./preferences"
import { safeNext } from "./redirect"
import { syncLanguage } from "./language-sync"
import { isChangingLanguage } from "./set-language"
import { ACCOUNT_SETTINGS_PATH, settingsMessage } from "./settings"
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
 * `next`. An external provider (Steam) is no OAuth provider of Supabase Auth: the hub's own route does the dance (`/auth/steam`) and the browser just goes there. Resolves with a sentence for the visitor when it cannot start
 * (and with null when the browser is on its way).
 */
export async function signInWith(provider: AnyProvider, next: string): Promise<string | null> {
  if (isExternalProvider(provider)) {
    window.location.assign(`/auth/${provider}?next=${encodeURIComponent(safeNext(next))}`)
    return null
  }
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

/** What became of a change a member asked for on their account: done, not done because nobody is signed in (a guest, the demo account), or not done, with the sentence to tell them (`settingsMessage`). */
export type ChangeOutcome = { status: "done" } | { status: "no-session" } | { status: "failed"; message: string }

/**
 * Asks Supabase Auth for one change of the signed-in member's account. Nothing is taken for granted: the project may not be set, nobody may be signed in (the demo account holds no session), and the call may be refused or may throw
 * (the network): each is an outcome, never an exception, and a refusal is told in the words of `settingsMessage`, not in Supabase's.
 */
async function change(run: (supabase: SupabaseClient) => Promise<{ error: unknown }>): Promise<ChangeOutcome> {
  const supabase = browserClient()
  if (!supabase) return { status: "failed", message: "This is not available here." }
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return { status: "no-session" }
    const { error } = await run(supabase)
    return error ? { status: "failed", message: settingsMessage(error) } : { status: "done" }
  } catch (error) {
    return { status: "failed", message: settingsMessage(error) }
  }
}

/**
 * Keeps the nickname the member chose for themselves in their account, under the one key of ours (`NICKNAME_KEY`: a provider writes `full_name` again at every sign-in, so a nickname kept there would not last), or takes it away (`null`):
 * the account is then called what its provider says. It is the only writer of the nickname, as `saveLanguage` is of the language.
 */
export function saveNickname(nickname: string | null): Promise<ChangeOutcome> {
  return change((supabase) => supabase.auth.updateUser({ data: { [NICKNAME_KEY]: nickname } }))
}

/** Keeps one preference of the member on their account, under its own key (`PREFERENCE_KEYS`): the others are left as they are, since `updateUser` merges `data` key by key. */
export function savePreference<Name extends PreferenceName>(name: Name, value: Preferences[Name]): Promise<ChangeOutcome> {
  return change((supabase) => supabase.auth.updateUser({ data: { [PREFERENCE_KEYS[name]]: value } }))
}

/** Keeps the country or region the member recorded, an ISO 3166-1 alpha-2 code, under the one key of ours (`COUNTRY_KEY`), or takes it away (`null`). It is the only writer of it, as `saveNickname` is of the nickname. */
export function saveCountry(country: string | null): Promise<ChangeOutcome> {
  return change((supabase) => supabase.auth.updateUser({ data: { [COUNTRY_KEY]: country } }))
}

/**
 * Asks to change the account's e-mail address: Supabase Auth sends a link to the new address (and to the current one, when the project asks both to confirm) and the address changes once they are opened. The link comes back through
 * `/auth/callback`, which exchanges its one-time code for the session (the call is made with a PKCE challenge, so the link brings a code and not a token) and sends the member on to the settings (`ACCOUNT_SETTINGS_PATH`; both are
 * allowed by the project's redirect URLs). Nothing changes in the account until then.
 */
export function changeEmail(email: string): Promise<ChangeOutcome> {
  return change((supabase) => supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(ACCOUNT_SETTINGS_PATH)}` }))
}

/** Sets the account's password, or a first one for an account that came in with a provider. The project may ask for a recent sign-in first (`reauthenticate`). */
export function changePassword(password: string): Promise<ChangeOutcome> {
  return change((supabase) => supabase.auth.updateUser({ password }))
}

/**
 * Links a provider to the account: the browser leaves for the provider, which sends the member back to `/auth/callback`, which sends them on to the settings. It only works when the project has "Allow manual linking" on (Authentication ›
 * Settings); when it has not, the member is told so. Done means the browser is on its way.
 */
export function linkProvider(provider: Provider): Promise<ChangeOutcome> {
  return change((supabase) =>
    supabase.auth.linkIdentity({ provider, options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(ACCOUNT_SETTINGS_PATH)}` } }),
  )
}

/** Unlinks a provider from the account. The last way in cannot be unlinked (`last-service`), and the project must allow manual linking, which covers unlinking as well. */
export function unlinkProvider(provider: Provider): Promise<ChangeOutcome> {
  return change(async (supabase) => {
    const { data, error } = await supabase.auth.getUserIdentities()
    if (error) return { error }
    const identity = data.identities.find((candidate) => candidate.provider === provider)
    return identity ? supabase.auth.unlinkIdentity(identity) : { error: { code: "identity_not_found" } }
  })
}

/** Signs the member out of every device but this one: Supabase Auth ends their other sessions, which stop at their next renewal (the access token they hold lasts up to an hour). */
export function signOutOtherDevices(): Promise<ChangeOutcome> {
  return change((supabase) => supabase.auth.signOut({ scope: "others" }))
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
 * Keeps the device of a signed-in member in step with their account's choice for the site's motion (`syncMotion`), each time the browser reads their session: the cookie and the attribute of `<html>` are written when they hold another
 * choice. A choice made on another device arrives with the next renewal of the session, within the hour. Nothing for a guest and for the demo account. Mount it once, where `useAccount` already is (`MotionSync` of the app).
 */
export function useMotionSync(): void {
  const state = useAccount()
  useEffect(() => {
    syncMotion(state, document.cookie, (choice) => applyMotion(choice))
  }, [state])
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
