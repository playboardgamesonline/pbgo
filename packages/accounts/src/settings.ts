// The settings of an account (PLT-111): what is wrong with a nickname, an address or a password that a member typed, the sentence a member is told when Supabase Auth refuses a change, the place the way back from an
// e-mail or a provider leads to, and how a browser is named. Pure, so that the forms, the calls to Supabase in `./client` and the tests all read it the same way (docs/accounts.md).

import { emailOf } from "./account"
import { DISPLAY_NAME_MAX, NAME_FORBIDDEN_CHARACTERS, NAME_FORBIDDEN_PROBLEM, PASSWORD_MAX_BYTES, PASSWORD_MIN, cleanDisplayName, failureKind, failureOf } from "./signup"

/** The page of the settings that a member lands on when they come back from the link of an e-mail (a new address to confirm) or from a provider (a service to link): a path of this site, which `safeNext` takes. */
export const ACCOUNT_SETTINGS_PATH = "/me/settings/account"

const byteLength = (text: string): number => new TextEncoder().encode(text).length

/** A username as the member typed it (what the code calls the nickname: the name they chose for themselves), judged: the name kept (cleaned like a display name), or what is wrong with it. The same 20 characters as at sign-up, since that is what a table copies and what the others see. */
export function checkNickname(text: string): { ok: true; nickname: string } | { ok: false; problem: string } {
  const nickname = cleanDisplayName(text)
  if (nickname === "") return { ok: false, problem: "Enter a username." }
  if (Array.from(nickname).length > DISPLAY_NAME_MAX) return { ok: false, problem: `Use ${DISPLAY_NAME_MAX} characters at most.` }
  if (NAME_FORBIDDEN_CHARACTERS.test(nickname)) return { ok: false, problem: NAME_FORBIDDEN_PROBLEM }
  return { ok: true, nickname }
}

/** How many characters a username has left, which is the counter of its field: counted as `checkNickname` counts, on the name as it will be kept and in characters as a person counts them (an emoji is one), so it is negative exactly when the name is refused for its length. */
export function nicknameCharactersLeft(text: string): number {
  return DISPLAY_NAME_MAX - Array.from(cleanDisplayName(text)).length
}

/** A new e-mail address as the member typed it, judged against the one they have: the address to send the link to, or what is wrong with it. */
export function checkEmailChange(current: string | null, text: string): { ok: true; email: string } | { ok: false; problem: string } {
  if (text.trim() === "") return { ok: false, problem: "Enter your new e-mail address." }
  const email = emailOf(text)
  if (email === null) return { ok: false, problem: "That does not look like an e-mail address." }
  if (current !== null && email.toLowerCase() === current.toLowerCase()) return { ok: false, problem: "That is the address you already have." }
  return { ok: true, email }
}

/** What is wrong with each field of the password form, in a sentence a member can act on. */
export type PasswordProblems = { password?: string; confirm?: string }

/** The two fields of the password form judged: the rules of the sign-up (8 characters at least, what bcrypt can keep at most, nothing about what it is made of) and the second field the same as the first. */
export function checkPasswordChange(password: string, confirm: string): { ok: true } | { ok: false; problems: PasswordProblems } {
  const problems: PasswordProblems = {}
  if (password === "") problems.password = "Choose a password."
  else if (Array.from(password).length < PASSWORD_MIN) problems.password = `Use at least ${PASSWORD_MIN} characters.`
  else if (byteLength(password) > PASSWORD_MAX_BYTES) problems.password = `Use a shorter password: ${PASSWORD_MAX_BYTES} characters at most.`
  if (!problems.password && confirm !== password) problems.confirm = "The two passwords are not the same."
  return Object.keys(problems).length > 0 ? { ok: false, problems } : { ok: true }
}

/** The ways a change of the account can fail, as far as a member is told apart: what to do next is what differs. */
export type SettingsProblem =
  | "weak-password"
  /** The new password is the one they have. */
  | "same-password"
  /** The project wants a recent sign-in before it changes a password. */
  | "reauthenticate"
  | "invalid-email"
  | "unavailable"
  | "rate-limit"
  /** Linking and unlinking a service is not switched on in the project (Authentication › Settings › Allow manual linking). */
  | "manual-linking"
  /** The service is their last way in. */
  | "last-service"
  /** The service's account is already another member's. */
  | "service-taken"
  /** The member already has an account of that service linked: one at most, they unlink it first. */
  | "has-another"
  | "network"
  | "other"

/** What the codes of Supabase Auth's errors mean here that the sign-up does not already tell (https://supabase.com/docs/guides/auth/debugging/error-codes). `email_exists` is told like an address that cannot be used, never as taken: a session is enough to ask, and an answer would tell which addresses have an account. */
const BY_CODE: Record<string, SettingsProblem> = {
  weak_password: "weak-password",
  same_password: "same-password",
  reauthentication_needed: "reauthenticate",
  reauthentication_not_valid: "reauthenticate",
  // A member with a second step who changes their password or address from a session that has not passed it (PLT-129): signing in again leads to the code
  insufficient_aal: "reauthenticate",
  email_exists: "invalid-email",
  email_address_invalid: "invalid-email",
  manual_linking_disabled: "manual-linking",
  single_identity_not_deletable: "last-service",
  identity_already_exists: "service-taken",
}

/** Which way a failed change went: its code decides when it is one of the above, else what the sign-up tells apart (the network, a server that failed, too many requests). */
export function settingsProblem(error: unknown): SettingsProblem {
  const { code } = failureOf(error)
  const known = code === undefined ? undefined : BY_CODE[code]
  if (known) return known
  switch (failureKind(error)) {
    case "weak-password":
      return "weak-password"
    case "invalid-email":
      return "invalid-email"
    case "unavailable":
      return "unavailable"
    case "rate-limit":
      return "rate-limit"
    case "network":
      return "network"
    default:
      return "other"
  }
}

/** What a member is told for each way a change can fail: plain words, never Supabase's own messages. */
export const SETTINGS_MESSAGES: Record<SettingsProblem, string> = {
  "weak-password": "That password is too weak. Choose a longer one.",
  "same-password": "Choose a password that is different from the one you have.",
  reauthenticate: "For your security, sign in again, then try once more.",
  "invalid-email": "That e-mail address cannot be used. Check it, or use another one.",
  unavailable: "We could not send the e-mail. Try again in a few minutes.",
  "rate-limit": "Too many attempts. Wait a few minutes and try again.",
  "manual-linking": "Linking another service is not available right now.",
  "last-service": "You need at least one way to sign in. Add another one first.",
  "service-taken": "That account is already linked to another member.",
  "has-another": "You already have an account of that service linked. Unlink it first.",
  network: "We could not reach the server. Check your connection and try again.",
  other: "That did not work. Try again.",
}

/** The sentence for a change that failed, from the error Supabase Auth answered with (or the network layer threw). */
export function settingsMessage(error: unknown): string {
  return SETTINGS_MESSAGES[settingsProblem(error)]
}

/** What the way back of a link made through the hub's own routes (Steam) says of how it went, in the `?steam=` of the settings: done, or the sentence of why it was not. */
export type LinkNotice = { done: true } | { done: false; message: string }

/**
 * Reads the `?steam=` that `/auth/steam/callback` adds to the settings after a link: `linked`, `taken` (another member holds the account), `has-another` (the member has a Steam account linked already) or `failed`. Anything else, or
 * nothing, is nothing to say: a made-up value shows no sentence of its own, only the ones above, which are ours.
 */
export function linkNoticeOf(value: string | null | undefined): LinkNotice | null {
  switch (value) {
    case "linked":
      return { done: true }
    case "taken":
      return { done: false, message: SETTINGS_MESSAGES["service-taken"] }
    case "has-another":
      return { done: false, message: SETTINGS_MESSAGES["has-another"] }
    case "failed":
      return { done: false, message: SETTINGS_MESSAGES.other }
    default:
      return null
  }
}

/** What the answer of `POST /api/hub/unlink-external` (`{ error: <code> }`) comes to: nobody is signed in, or which way the change failed (`SETTINGS_MESSAGES`). */
export function unlinkProblem(code: unknown): SettingsProblem | "no-session" {
  switch (code) {
    case "NOT_SIGNED_IN":
      return "no-session"
    case "LAST_WAY_IN":
      return "last-service"
    case "RATE_LIMITED":
    case "TOO_MANY_REQUESTS":
      return "rate-limit"
    default:
      return "other"
  }
}

/** A browser and the system it runs on, as far as its user agent says. */
export type Device = { browser: string; system: string | null }

/**
 * Names the browser and the system of a user agent, in the words a member would use ("Chrome on macOS"): the order of the tests is the order of the traps (Edge and Opera say Chrome and Safari too, Chrome says Safari, an iPhone says Mac OS X and
 * an Android phone says Linux). It is the member's own device they are told about, read in their browser; a user agent that says nothing we know is just "Browser".
 */
export function describeDevice(userAgent: string): Device {
  const browser = /Edg(?:e|A|iOS)?\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Firefox\/|FxiOS\//.test(userAgent)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser"
  const system = /iPhone|iPad|iPod/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /CrOS/.test(userAgent)
          ? "ChromeOS"
          : /Mac OS X|Macintosh/.test(userAgent)
            ? "macOS"
            : /Linux/.test(userAgent)
              ? "Linux"
              : null
  return { browser, system }
}

/** "Chrome on macOS", or just the browser when the system is not known. */
export function deviceLabel({ browser, system }: Device): string {
  return system === null ? browser : `${browser} on ${system}`
}
