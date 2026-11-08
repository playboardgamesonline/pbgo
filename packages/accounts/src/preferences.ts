// What a member keeps on their account besides their language (PLT-111): a nickname of their own and a few preferences, each under a key of `user_metadata` that is ours. The keys carry the namespace
// `pbgo_` because a provider writes its own keys into the same object at every sign-in (`full_name`, `avatar_url`…): a nickname kept under `full_name` would be undone by the next sign-in with Google,
// while a key the providers cannot name is left as it is (docs/accounts.md, "What a provider's sign-in does to `user_metadata`"). Like the language, each has one writer in `./client` and one reader here, so
// that they move to a `profiles` table the day it exists (PLT-13) by changing those two places alone. Pure, with no import, so that the browser, the server and the tests read it the same way.

/** The nickname the member chose for themselves: it wins over the name a provider gives, which they cannot edit there. */
export const NICKNAME_KEY = "pbgo_nickname"

/** The keys of the preferences, by name. Each holds a boolean, and a value that is not one (the member can write their own `user_metadata`) reads as the default. */
export const PREFERENCE_KEYS = {
  /** A browser notification when a game waits for them (PLT-24). */
  notifyTurn: "pbgo_notify_turn",
  /** A browser notification when a friend invites them to a table (PLT-24). */
  notifyInvites: "pbgo_notify_invites",
  /** Their game history is hidden from the other players: it is public by default (PLT-16). */
  hideHistory: "pbgo_hide_history",
} as const

export type PreferenceName = keyof typeof PREFERENCE_KEYS

export type Preferences = Record<PreferenceName, boolean>

/** What a preference is until the member sets it. */
export const DEFAULT_PREFERENCES: Preferences = { notifyTurn: true, notifyInvites: true, hideHistory: false }

/** The part of an account that holds the free object `user_metadata`: a user of Supabase Auth, or what the tests make of one. */
type WithMetadata = { user_metadata?: Record<string, unknown> | null }

/** The preferences of a user: each as they set it, else its default. Anything that is not a boolean is no choice. */
export function preferencesOf(user: WithMetadata): Preferences {
  const claims = user.user_metadata ?? {}
  const read = (name: PreferenceName): boolean => {
    const value = claims[PREFERENCE_KEYS[name]]
    return typeof value === "boolean" ? value : DEFAULT_PREFERENCES[name]
  }
  return { notifyTurn: read("notifyTurn"), notifyInvites: read("notifyInvites"), hideHistory: read("hideHistory") }
}

/** The longest nickname the account is believed to hold when it is read: the form keeps it to 20 (`DISPLAY_NAME_MAX`), and a table copies 20 at most, but anyone can write their own metadata. */
const NICKNAME_READ_MAX = 40

/** The nickname the member chose, cleaned like a display name (no control character, one space between words, trimmed), or null when they chose none, or when what the key holds is not a sensible name. */
export function nicknameOf(user: WithMetadata): string | null {
  const value = user.user_metadata?.[NICKNAME_KEY]
  if (typeof value !== "string") return null
  const text = value.replace(/\p{Cc}/gu, "").replace(/\s+/g, " ").trim()
  return text !== "" && Array.from(text).length <= NICKNAME_READ_MAX ? text : null
}
