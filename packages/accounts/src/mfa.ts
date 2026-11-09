// Multi-factor authentication (PLT-129): a member can ask for a second step at every sign-in, the six-digit code of an authenticator app. It is a TOTP factor of Supabase Auth, which keeps the secret and judges the code; what is
// here is what the hub decides around it: which factors count, whether a session has passed the second step, what a member is told, and the few things the window that sets it up draws. Pure, so that the browser, the server, the
// proxy and the tests read it the same way (docs/accounts.md, "Multi-factor authentication").

import { failureKind, failureOf } from "./signup"

/** The digits of the code an authenticator app shows: six, whatever the app (Supabase Auth's TOTP has a 30 second step and allows one step of skew). */
export const TOTP_LENGTH = 6

/** Whether a text is a code as an authenticator app shows it: six digits and nothing else. Anything else is told wrong before the Auth server is asked, which counts every attempt against a limit. */
export function isTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

/** The name the hub gives the factor it asks Supabase Auth to make. A name is unique for a user, and the hub offers one authenticator app, so it never needs another. */
export const TOTP_FACTOR_NAME = "Authenticator app"

/** The part of a factor of Supabase Auth that is read here: `user.factors` of the user the Auth server answers with. A factor is `unverified` until the member has typed one code from their app. */
export type AuthFactor = { id?: string; factor_type?: string; status?: string; friendly_name?: string | null; created_at?: string | null }

/** An authenticator app that gives a member the second step: a verified TOTP factor. Only TOTP is offered, so only TOTP counts: a factor of another kind could not be asked for at sign-in, and would lock the member out. */
export type SecondStepDevice = { id: string; name: string | null; createdAt: string | null }

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null)

/** The authenticator apps a member has set up, from the factors the Auth server lists for them: the verified TOTP ones. A factor that was started and never proved (an abandoned set-up) is not one. */
export function secondStepDevicesOf(factors: readonly AuthFactor[] | null | undefined): SecondStepDevice[] {
  return (factors ?? []).flatMap((factor): SecondStepDevice[] => {
    const id = text(factor.id)
    return id !== null && factor.factor_type === "totp" && factor.status === "verified" ? [{ id, name: text(factor.friendly_name), createdAt: text(factor.created_at) }] : []
  })
}

/** What a session has proved of its member: `aal1`, one way in (a password, a provider, a link), or `aal2`, that and a second factor. */
export type Assurance = "aal1" | "aal2"

/**
 * The level that an access token says its session has (the `aal` claim of the JWT; a token with none is `aal1`, as Supabase's guide says, and so is a claim that says anything else), or null when the text is not a JWT of the shape
 * Supabase Auth issues. **The signature is not checked**: this is only read from a token that the Auth server has accepted already (on the server, `getUser()` has just answered for it) or that the browser holds as its own session,
 * so the claim cannot have been written by somebody else; the level of a token that nobody vouched for must never be read here.
 */
export function aalOf(accessToken: string | null | undefined): Assurance | null {
  if (typeof accessToken !== "string") return null
  const parts = accessToken.split(".")
  const payload = parts[1]
  if (parts.length !== 3 || payload === undefined) return null
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (char) => char.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof claims !== "object" || claims === null) return null
    return (claims as { aal?: unknown }).aal === "aal2" ? "aal2" : "aal1"
  } catch {
    return null
  }
}

/** Whether a session still has the second step to pass: its member has an authenticator app set up and the session has not proved it. A level that could not be read counts as not proved. */
export function secondStepPending(devices: readonly SecondStepDevice[], assurance: Assurance | null): boolean {
  return devices.length > 0 && assurance !== "aal2"
}

/** The same, from what a session holds: its user, with the factors the Auth server listed for them, and its access token. A session of nobody has nothing to pass. */
export function secondStepPendingOf(user: { factors?: readonly AuthFactor[] | null } | null | undefined, accessToken: string | null | undefined): boolean {
  return secondStepPending(secondStepDevicesOf(user?.factors), aalOf(accessToken))
}

/** The ways a call about the second step can fail, as far as a member is told apart: what to do next is what differs. */
export type MfaProblem =
  /** The code is wrong or has expired: Supabase Auth says the same for both. */
  | "wrong-code"
  /** The code was asked for too long ago to answer it: a new one is made for the next try. */
  | "challenge-expired"
  /** The connection changed between the two halves of the check, and Supabase Auth wants them from one address. */
  | "connection-changed"
  /** The project has switched app authenticators off (enrolment or verification). */
  | "unavailable"
  /** The member holds as many authenticator apps as the project allows. */
  | "too-many-devices"
  /** The session has not passed the second step, which this asks for: signing in again leads there. */
  | "reauthenticate"
  /** The session the call was made with is gone: it was ended elsewhere (the member signed out their other devices, or another device passed the second step, which ends the sessions that have not). Signing in again is the way. */
  | "session-ended"
  | "rate-limit"
  | "network"
  | "server"
  | "other"

/** What the codes of Supabase Auth's errors mean here (https://supabase.com/docs/guides/auth/debugging/error-codes); the rest is what the sign-up already tells apart. */
const BY_CODE: Record<string, MfaProblem> = {
  mfa_verification_failed: "wrong-code",
  mfa_challenge_expired: "challenge-expired",
  mfa_ip_address_mismatch: "connection-changed",
  mfa_totp_enroll_not_enabled: "unavailable",
  mfa_totp_verify_not_enabled: "unavailable",
  too_many_enrolled_mfa_factors: "too-many-devices",
  insufficient_aal: "reauthenticate",
  // The session this was asked with is gone, or its token is no good any more
  session_not_found: "session-ended",
  session_expired: "session-ended",
  bad_jwt: "session-ended",
  refresh_token_not_found: "session-ended",
  refresh_token_already_used: "session-ended",
  // Only a hook of the project can say this, and it says it to stop somebody who is guessing
  mfa_verification_rejected: "rate-limit",
}

/** Which way a failed call went: its code decides when it is one of the above, else the network, a limit or a server that failed. */
export function mfaProblem(error: unknown): MfaProblem {
  const { code, name } = failureOf(error)
  // The client library makes an `AuthSessionMissingError` (status 400, no code) of an Auth server that says it knows no such session, or of a browser that holds none
  if (name === "AuthSessionMissingError") return "session-ended"
  const known = code === undefined ? undefined : BY_CODE[code]
  if (known) return known
  switch (failureKind(error)) {
    case "rate-limit":
      return "rate-limit"
    case "network":
      return "network"
    case "unavailable":
      return "server"
    default:
      return "other"
  }
}

/** What a member is told for each way a call can fail: plain words, never Supabase's own messages. */
export const MFA_MESSAGES: Record<MfaProblem, string> = {
  "wrong-code": "That code is wrong or has expired. Check your app for the one it shows now.",
  "challenge-expired": "That took too long. Enter the code your app shows now.",
  "connection-changed": "Your connection changed while you were doing this. Start again.",
  unavailable: "Multi-factor authentication is not available right now.",
  "too-many-devices": "You cannot add another authenticator app. Remove one first.",
  reauthenticate: "For your security, sign in again and enter your code, then try once more.",
  "session-ended": "Your sign-in has ended. Sign in again.",
  "rate-limit": "Too many attempts. Wait a minute and try again.",
  network: "We could not reach the server. Check your connection and try again.",
  server: "Something went wrong on our side. Try again in a few minutes.",
  other: "That did not work. Try again.",
}

/** The sentence for a call that failed, from the error Supabase Auth answered with (or the network layer threw). */
export function mfaMessage(error: unknown): string {
  return MFA_MESSAGES[mfaProblem(error)]
}

/** The setup key as it is shown to be typed into an app: groups of four, which is easier to read and to copy by eye ("ABCDEFGH" is "ABCD EFGH"). What the copy button puts in the clipboard has no spaces. */
export function formatSetupKey(secret: string): string {
  return secret.replace(/\s+/g, "").match(/.{1,4}/g)?.join(" ") ?? ""
}

/**
 * The picture of the QR code that Supabase Auth gives, as an address an `<img>` can take, or null when it gives anything but an SVG data URI (the setup key is still there to type). The client library puts the markup after the comma as
 * it is, where a `#` or a `%` of its own would cut the address short or be read as an escape, so markup is encoded here; an address that is encoded already is left alone.
 */
export function qrImageOf(qr: unknown): string | null {
  if (typeof qr !== "string") return null
  const markup = /^data:image\/svg\+xml(?:;[^,]*)?,([\s\S]*)$/i.exec(qr)?.[1]
  if (markup === undefined) return null
  return markup.trimStart().startsWith("<") ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}` : qr
}

/** The day a factor was set up, as the row of the settings says it ("9 November 2026"), or null when the date is not known. On the UTC calendar, so that the server and the browser draw the same text. */
export function sinceLabel(iso: string | null | undefined): string | null {
  const time = iso ? Date.parse(iso) : Number.NaN
  return Number.isNaN(time) ? null : new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}
