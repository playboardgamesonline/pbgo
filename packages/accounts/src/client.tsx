"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { accountOf, emailOf, isExternalProvider, type Account, type AnyProvider, type ExternalProvider, type Provider } from "./account"
import { supabaseAuthConfig } from "./config"
import { DEMO_ACCOUNT, DEMO_COOKIE, demoAllowed, isDemoAccount } from "./demo"
import { COUNTRY_KEY } from "./details"
import { LANGUAGE_KEY, languageCookie, languageOf, type PlatformLanguage } from "./language"
import { applyDisplay, syncDisplay } from "./display"
import { NICKNAME_KEY, PREFERENCE_KEYS, type PreferenceName, type Preferences } from "./preferences"
import { MFA_MESSAGES, TOTP_FACTOR_NAME, isTotpCode, mfaMessage, mfaProblem, qrImageOf, secondStepPendingOf } from "./mfa"
import { safeNext } from "./redirect"
import { syncLanguage } from "./language-sync"
import { isChangingLanguage } from "./set-language"
import { ACCOUNT_SETTINGS_PATH, SETTINGS_MESSAGES, settingsMessage, unlinkProblem } from "./settings"
import { codeMessage, failureOf, resendOutcome, signupData, signupOutcome, type ResendOutcome, type SignupEntry, type SignupOutcome } from "./signup"

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
    // A session that holds the first factor alone, of a member whose account asks for a second (multi-factor authentication, PLT-129), is not a signed-in visitor yet: the navbar does not draw their dock before they give the code
    const read = (session: { user: Parameters<typeof accountOf>[0]; access_token: string } | null | undefined): AccountState =>
      session && !secondStepPendingOf(session.user, session.access_token) ? { status: "signed-in", account: accountOf(session.user) } : (demo ?? signedOut)
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState(read(data.session))
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState(read(session)))
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
 * (the network): each is an outcome, never an exception, and a refusal is told in the words of `settingsMessage` (or of `words`, for the calls that have words of their own: the second step's, `mfaMessage`), not in Supabase's.
 */
async function change(run: (supabase: SupabaseClient) => Promise<{ error: unknown }>, words: (error: unknown) => string = settingsMessage): Promise<ChangeOutcome> {
  const supabase = browserClient()
  if (!supabase) return { status: "failed", message: "This is not available here." }
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return { status: "no-session" }
    const { error } = await run(supabase)
    return error ? { status: "failed", message: words(error) } : { status: "done" }
  } catch (error) {
    return { status: "failed", message: words(error) }
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

/**
 * Links the account at an external provider (Steam, which the hub signs in to with its own routes, `/auth/<provider>`) to the account: the browser leaves for the provider, which sends the member back to their settings
 * (`ACCOUNT_SETTINGS_PATH`) with `?steam=` to say how it went (`linkNoticeOf`). It needs no setting of the Supabase project. Done means the browser is on its way.
 */
export function linkExternal(provider: ExternalProvider): Promise<ChangeOutcome> {
  window.location.assign(`/auth/${provider}?link=1`)
  return Promise.resolve({ status: "done" })
}

/**
 * Takes the account at an external provider off the account (`POST /api/hub/unlink-external`). The server checks that the member keeps another way in and answers `LAST_WAY_IN` when they would not; nothing throws, and every answer
 * is an outcome in the words of `SETTINGS_MESSAGES`.
 */
export async function unlinkExternal(provider: ExternalProvider): Promise<ChangeOutcome> {
  try {
    const response = await fetch("/api/hub/unlink-external", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) })
    if (response.ok) return { status: "done" }
    const body: unknown = await response.json().catch(() => null)
    const problem = unlinkProblem(typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined)
    return problem === "no-session" ? { status: "no-session" } : { status: "failed", message: SETTINGS_MESSAGES[problem] }
  } catch {
    return { status: "failed", message: SETTINGS_MESSAGES.network }
  }
}

/** Signs the member out of every device but this one: Supabase Auth ends their other sessions, which stop at their next renewal (the access token they hold lasts up to an hour). */
export function signOutOtherDevices(): Promise<ChangeOutcome> {
  return change((supabase) => supabase.auth.signOut({ scope: "others" }))
}

// Multi-factor authentication (PLT-129): the second step of a sign-in, the code of an authenticator app, which is a TOTP factor of Supabase Auth. The browser makes every call: the limit on the codes is the Auth server's, per address, and
// it must see the visitor's own, not the server's. What the hub decides around them is pure and in `./mfa`; the server's side is `getSessionState` (`./server`).

/**
 * Whether a member who just signed in has the second step left to pass: their account has an authenticator app set up and the session, which holds the first factor alone (a password, a provider, a link), has not proved it. The Auth
 * server is asked for the user, whose factors are fresh, and the level is read from the session's own token. False when nobody is signed in, when the project is not set and when the question could not be asked: the page that
 * comes next asks the server again, which is the one that decides.
 */
export async function secondStepNeeded(): Promise<boolean> {
  const supabase = browserClient()
  if (!supabase) return false
  try {
    const [{ data: fresh }, { data: held }] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()])
    return secondStepPendingOf(fresh.user, held.session?.access_token)
  } catch {
    return false
  }
}

/** Asks the Auth server whether a code comes from one of the signed-in member's authenticator apps: a challenge and then the code, for each app in turn while the answer is "wrong code" (the member does not say which app it comes from). Resolves with the error that stopped it, or null when an app accepted the code. */
async function proveSecondStep(supabase: SupabaseClient, code: string): Promise<{ error: unknown } | null> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return { error }
  if (data.totp.length === 0) return { error: { code: "mfa_factor_not_found" } }
  let failed: unknown = null
  for (const factor of data.totp) {
    const result = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    if (!result.error) return null
    failed = result.error
    // Only a wrong code is worth trying against the next app: a limit, or the network, would fail the same
    if (failureOf(result.error).code !== "mfa_verification_failed") break
  }
  return { error: failed }
}

/** What giving a code at sign-in came to: they are through, the code did not work (with the sentence to tell them, and a wrong code and an expired one are one answer), or their sign-in has ended (a session that was ended elsewhere: signing in again is the way, the card says so). */
export type VerifyOutcome = { status: "done" } | { status: "failed"; message: string } | { status: "session-ended"; message: string }

/**
 * Gives the Auth server the code of an authenticator app to finish a sign-in: the session that holds the first factor becomes one that holds both (`aal2`), the browser's cookies carry it, and the page can go on to `next` with a whole page load.
 * A text that is not six digits is told wrong without asking: every try counts against the Auth server's limit.
 */
export async function verifySecondStep(code: string): Promise<VerifyOutcome> {
  const supabase = browserClient()
  if (!supabase) return { status: "failed", message: "Sign-in is not available here." }
  if (!isTotpCode(code)) return { status: "failed", message: MFA_MESSAGES["wrong-code"] }
  const told = (error: unknown): VerifyOutcome => ({ status: mfaProblem(error) === "session-ended" ? "session-ended" : "failed", message: mfaMessage(error) })
  try {
    const failed = await proveSecondStep(supabase, code)
    return failed ? told(failed.error) : { status: "done" }
  } catch (error) {
    return told(error)
  }
}

/** What the window that sets the second step up is given: the factor to prove, the picture of its QR code (null when Supabase Auth gave none that can be drawn) and the setup key, to type into an app that cannot scan it. */
export type SecondStepSetup = { factorId: string; qr: string | null; secret: string }

/** What starting the set-up came to: the factor is made and waits for a code, nobody is signed in (a guest, the demo account), or it could not be made, with the sentence to tell the member. */
export type SetupOutcome = { status: "ready"; setup: SecondStepSetup } | { status: "no-session" } | { status: "failed"; message: string }

/**
 * Starts setting the second step up: Supabase Auth makes a TOTP factor, which is not one yet (`unverified`) until a code from the app has been given (`finishSecondStepSetup`), and answers with its QR code and its key. `issuer` is the name
 * that the app lists the account under (the site's). A set-up that was abandoned left a factor that nobody proved, which the Auth server keeps for a few minutes and which holds the name this one needs: those are taken away first.
 */
export async function beginSecondStepSetup(issuer: string): Promise<SetupOutcome> {
  const supabase = browserClient()
  if (!supabase) return { status: "failed", message: "This is not available here." }
  try {
    const { data: held } = await supabase.auth.getSession()
    if (!held.session) return { status: "no-session" }
    const listed = await supabase.auth.mfa.listFactors()
    if (listed.error) return { status: "failed", message: mfaMessage(listed.error) }
    if (listed.data.totp.length > 0) return { status: "failed", message: "Multi-factor authentication is already on." }
    for (const factor of listed.data.all) {
      if (factor.factor_type === "totp") await supabase.auth.mfa.unenroll({ factorId: factor.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer, friendlyName: TOTP_FACTOR_NAME })
    if (error) return { status: "failed", message: mfaMessage(error) }
    return { status: "ready", setup: { factorId: data.id, qr: qrImageOf(data.totp.qr_code), secret: data.totp.secret } }
  } catch (error) {
    return { status: "failed", message: mfaMessage(error) }
  }
}

/**
 * Finishes the set-up with the first code of the app: the factor becomes the member's second step, and the session they are in becomes one that has passed it (`aal2`), so that nothing asks them for a code on this device now. Supabase Auth
 * ends every other session of the member that has not passed the second step: their other devices sign in again, with the code. A text that is not six digits is told wrong without asking.
 */
export function finishSecondStepSetup(factorId: string, code: string): Promise<ChangeOutcome> {
  if (!isTotpCode(code)) return Promise.resolve({ status: "failed", message: MFA_MESSAGES["wrong-code"] })
  return change(async (supabase) => {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    return { error }
  }, mfaMessage)
}

/** Gives up a set-up that was started: the factor that was made is taken away. The Auth server would drop it by itself, so a failure here is not worth telling. */
export async function cancelSecondStepSetup(factorId: string): Promise<void> {
  const supabase = browserClient()
  if (!supabase) return
  try {
    await supabase.auth.mfa.unenroll({ factorId })
  } catch {
    // The factor was never proved: it expires on its own
  }
}

/**
 * Turns the second step off, on a code of the app (the session has passed it already, so the Auth server would not ask: the hub does, since a window left open must not be enough): the code is checked first, then every authenticator app of the
 * member is removed. A session renews its access token once it is done, which is what brings the one of a member with no second step.
 */
export function removeSecondStep(code: string): Promise<ChangeOutcome> {
  if (!isTotpCode(code)) return Promise.resolve({ status: "failed", message: MFA_MESSAGES["wrong-code"] })
  return change(async (supabase) => {
    const failed = await proveSecondStep(supabase, code)
    if (failed) return failed
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) return { error }
    for (const factor of data.totp) {
      const { error: removed } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (removed) return { error: removed }
    }
    // A failed renewal changes nothing that matters: the session is still good, and the token is renewed within the hour
    await supabase.auth.refreshSession().catch(() => {})
    return { error: null }
  }, mfaMessage)
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
 * Keeps the device of a signed-in member in step with their account's choices for how the site is shown, its motion and its transparency (`syncDisplay`), each time the browser reads their session: the cookie and the attribute of `<html>` are
 * written for each setting whose cookie holds another choice. A choice made on another device arrives with the next renewal of the session, within the hour. Nothing for a guest and for the demo account. Mount it once, where `useAccount`
 * already is (`DisplaySync` of the app).
 */
export function useDisplaySync(): void {
  const state = useAccount()
  useEffect(() => {
    syncDisplay(state, document.cookie, applyDisplay)
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
