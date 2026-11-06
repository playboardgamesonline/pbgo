// The sign-up with an e-mail address and a password (PLT-117): what the form asks, what is wrong with an entry, the display name an account is made with, and what each answer of Supabase Auth is told to a visitor
// in plain words. Pure, so that the form, the calls to Supabase in `./client` and the tests all read it the same way (docs/accounts.md).

import { emailOf } from "./account"

/** The shortest password. The project's own setting (Authentication › Providers › Email) is the owner's: the form asks the same, so that the server has little to refuse that the form let through. */
export const PASSWORD_MIN = 8

/** The longest password, in bytes: Supabase Auth hashes it with bcrypt, which reads 72 of them and no more. */
export const PASSWORD_MAX_BYTES = 72

/** The longest display name, in characters as a person counts them (an emoji is one): what a table copies of an account is 20 at most (`NICKNAME_MAX` of core), and it is what the others see. */
export const DISPLAY_NAME_MAX = 20

/** The key of `user_metadata`, the free object of the account, where the display name given at sign-up is kept: `full_name`, the one Google and Facebook fill and `accountOf` reads for the nickname, so no reader needs to know the account was made here. */
export const DISPLAY_NAME_KEY = "full_name"

/** The digits of the code in the confirmation e-mail (`{{ .Token }}`: Supabase Auth's e-mail codes are six digits). */
export const CODE_LENGTH = 6

/** How long a visitor waits before asking for another code: Supabase Auth sends one confirmation e-mail a minute to an address. */
export const RESEND_SECONDS = 60

/** What the form holds. */
export type SignupFields = { email: string; password: string; name: string }

/** What is wrong with each field, in a sentence a visitor can act on. */
export type SignupProblems = Partial<Record<keyof SignupFields, string>>

/** What is sent: the address trimmed, the password as it was typed (a space in it is a character), and the display name cleaned, or null when none was given. */
export type SignupEntry = { email: string; password: string; name: string | null }

/** A display name as it is kept: no control character, one space between words, trimmed. */
export function cleanDisplayName(name: string): string {
  return name.replace(/\p{Cc}/gu, "").replace(/\s+/g, " ").trim()
}

const byteLength = (text: string): number => new TextEncoder().encode(text).length

/**
 * Judges the form before anything is sent: an entry, or what is wrong with each field. The e-mail address is what `emailOf` takes for one, the password is 8 characters at least and what bcrypt can keep at most, with no rule
 * about what it is made of (a long one is stronger than a mixed one), and the display name is optional and 20 characters at most.
 */
export function checkSignup(fields: SignupFields): { ok: true; entry: SignupEntry } | { ok: false; problems: SignupProblems } {
  const problems: SignupProblems = {}
  const email = emailOf(fields.email)
  if (fields.email.trim() === "") problems.email = "Enter your e-mail address."
  else if (email === null) problems.email = "That does not look like an e-mail address."

  if (fields.password === "") problems.password = "Choose a password."
  else if (Array.from(fields.password).length < PASSWORD_MIN) problems.password = `Use at least ${PASSWORD_MIN} characters.`
  else if (byteLength(fields.password) > PASSWORD_MAX_BYTES) problems.password = `Use a shorter password: ${PASSWORD_MAX_BYTES} characters at most.`

  const name = cleanDisplayName(fields.name)
  if (Array.from(name).length > DISPLAY_NAME_MAX) problems.name = `Use ${DISPLAY_NAME_MAX} characters at most.`

  if (email === null || Object.keys(problems).length > 0) return { ok: false, problems }
  return { ok: true, entry: { email, password: fields.password, name: name === "" ? null : name } }
}

/** The `data` of the sign-up, which Supabase Auth keeps in the account's `user_metadata`: the display name under the key `accountOf` reads, and nothing at all when none was given (the nickname is then the start of the address). */
export function signupData(name: string | null): Record<string, string> | undefined {
  return name ? { [DISPLAY_NAME_KEY]: name } : undefined
}

/** The part of what went wrong that is read here. It is an `AuthError` of Supabase, or what the network layer threw, or anything: nothing is taken for granted. */
export type AuthFailure = { code?: string; status?: number; name?: string; reasons?: readonly string[] }

/** What an error says of itself, read safely: a thrown thing that is not an error says nothing. */
export function failureOf(error: unknown): AuthFailure {
  if (typeof error !== "object" || error === null) return {}
  const { code, status, name, reasons } = error as Record<string, unknown>
  return {
    ...(typeof code === "string" ? { code } : {}),
    ...(typeof status === "number" ? { status } : {}),
    ...(typeof name === "string" ? { name } : {}),
    ...(Array.isArray(reasons) ? { reasons: reasons.filter((reason): reason is string => typeof reason === "string") } : {}),
  }
}

/** The ways a call to Supabase Auth can fail, as far as a visitor is told apart: what to do next is what differs. */
export type FailureKind =
  /** The password does not meet the project's rules. */
  | "weak-password"
  /** The address cannot be used (a domain Supabase refuses, such as an example one). */
  | "invalid-email"
  /** The e-mail cannot go out: the sender refuses the address (the built-in one only reaches the team's), is down or timed out, or the server failed. */
  | "unavailable"
  /** Too many requests, from this address or this network. */
  | "rate-limit"
  /** Sign-ups are switched off in the project. */
  | "closed"
  /** The CAPTCHA the project asks for was not passed. */
  | "captcha"
  /** The address already has an account. Never told to the visitor (`signupOutcome`). */
  | "taken"
  /** The code is wrong or has expired: Supabase Auth says the same for both. */
  | "wrong-code"
  /** The browser could not reach the server. */
  | "network"
  | "other"

/** What the codes of Supabase Auth's errors mean here (https://supabase.com/docs/guides/auth/debugging/error-codes). */
const BY_CODE: Record<string, FailureKind> = {
  weak_password: "weak-password",
  email_address_invalid: "invalid-email",
  email_address_not_authorized: "unavailable",
  unexpected_failure: "unavailable",
  request_timeout: "unavailable",
  hook_timeout: "unavailable",
  hook_timeout_after_retry: "unavailable",
  over_email_send_rate_limit: "rate-limit",
  over_request_rate_limit: "rate-limit",
  signup_disabled: "closed",
  email_provider_disabled: "closed",
  captcha_failed: "captcha",
  user_already_exists: "taken",
  email_exists: "taken",
  otp_expired: "wrong-code",
}

/** Which way a failure went. Its code decides when it has one; a request that never reached the server (`AuthRetryableFetchError` with status 0) is the network's, and a server that answered with an error of its own is not the visitor's doing. */
export function failureKind(error: unknown): FailureKind {
  const { code, status, name } = failureOf(error)
  const known = code === undefined ? undefined : BY_CODE[code]
  if (known) return known
  if (name === "AuthRetryableFetchError" && (status === undefined || status === 0)) return "network"
  if (status !== undefined && status >= 500) return "unavailable"
  return "other"
}

/** What the visitor is told when the sign-up does not go through, by what went wrong. `taken` is never told: an address that has an account looks like one that has not. */
const SIGNUP_MESSAGES: Record<Exclude<FailureKind, "taken" | "weak-password" | "wrong-code">, string> = {
  "invalid-email": "That e-mail address cannot be used. Check it, or use another one.",
  unavailable: "We could not send the e-mail. Try again in a few minutes.",
  "rate-limit": "Too many attempts. Wait a few minutes and try again.",
  closed: "Creating an account is not available right now. Try again later.",
  captcha: "We could not check that you are a person. Try again.",
  network: "We could not reach the server. Check your connection and try again.",
  other: "Sign-up did not work. Try again.",
}

/** What to tell a visitor whose password the project refuses, by the reasons it gives. */
function weakPasswordMessage(reasons: readonly string[] = []): string {
  if (reasons.includes("pwned")) return "That password is known from data breaches. Choose another one."
  if (reasons.includes("characters")) return "Mix letters, digits and symbols in your password."
  return "Choose a longer password."
}

/** What a sign-up came to: the e-mail is on its way, or a sentence for the visitor (and the field it is about, when it is about one). */
export type SignupOutcome = { sent: true } | { sent: false; message: string; field?: "email" | "password" }

/**
 * What a sign-up came to, from the error Supabase Auth answered with (null when it answered none). **An address that already has an account is a success here**: Supabase Auth answers a repeated sign-up like a new one
 * and sends nothing (an obfuscated user, not an error), and a project that auto-confirms answers `user_already_exists`: either way the page goes on to the code, so that nothing tells a stranger which addresses have an account.
 */
export function signupOutcome(error: unknown): SignupOutcome {
  if (error === null || error === undefined) return { sent: true }
  const kind = failureKind(error)
  if (kind === "taken") return { sent: true }
  if (kind === "weak-password") return { sent: false, message: weakPasswordMessage(failureOf(error).reasons), field: "password" }
  if (kind === "invalid-email") return { sent: false, message: SIGNUP_MESSAGES["invalid-email"], field: "email" }
  if (kind === "wrong-code") return { sent: false, message: SIGNUP_MESSAGES.other }
  return { sent: false, message: SIGNUP_MESSAGES[kind] }
}

/** What a visitor is told when the code they typed does not work, by the error Supabase Auth answered with: wrong and expired are one answer, since it does not tell them apart. */
export function codeMessage(error: unknown): string {
  switch (failureKind(error)) {
    case "wrong-code":
      return "That code is wrong or has expired. Check it, or ask for a new one."
    case "rate-limit":
      return SIGNUP_MESSAGES["rate-limit"]
    case "network":
      return SIGNUP_MESSAGES.network
    default:
      return "That code did not work. Try again."
  }
}

/** What came of asking for another code: a new one is on its way, the visitor has to wait (and is told for how long), or it failed (and may try again at once). */
export type ResendOutcome = { status: "sent" } | { status: "wait"; message: string } | { status: "failed"; message: string }

/** `ResendOutcome` from the error Supabase Auth answered with (null when it answered none). Like a sign-up, it says the same for an address that has an account, and for one that has none. */
export function resendOutcome(error: unknown): ResendOutcome {
  if (error === null || error === undefined) return { status: "sent" }
  switch (failureKind(error)) {
    case "rate-limit":
      return { status: "wait", message: "Wait a minute before asking for another code." }
    case "unavailable":
      return { status: "failed", message: SIGNUP_MESSAGES.unavailable }
    case "network":
      return { status: "failed", message: SIGNUP_MESSAGES.network }
    case "captcha":
      return { status: "failed", message: SIGNUP_MESSAGES.captcha }
    default:
      return { status: "failed", message: "We could not send a new code. Try again." }
  }
}

/** The seconds left until `until` (a time in milliseconds), 0 when it has passed: what the button that asks for another code counts down. */
export function secondsLeft(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000))
}
