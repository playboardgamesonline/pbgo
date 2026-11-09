// What a member keeps on their account besides their language (PLT-111): a nickname of their own and a few preferences, each under a key of `user_metadata` that is ours. The keys carry the namespace
// `pbgo_` because a provider writes its own keys into the same object at every sign-in (`full_name`, `avatar_url`…): a nickname kept under `full_name` would be undone by the next sign-in with Google,
// while a key the providers cannot name is left as it is (docs/accounts.md, "What a provider's sign-in does to `user_metadata`"). Like the language, each has one writer in `./client` and one reader here, so
// that they move to a `profiles` table the day it exists (PLT-13) by changing those two places alone. Pure, with no import, so that the browser, the server and the tests read it the same way.

/** The nickname the member chose for themselves: it wins over the name a provider gives, which they cannot edit there. */
export const NICKNAME_KEY = "pbgo_nickname"

/** How a time is written, as the member chose it: `auto` leaves the hour cycle to the page's own language, the two others force it. */
export const TIME_FORMATS = ["auto", "12h", "24h"] as const

export type TimeFormat = (typeof TIME_FORMATS)[number]

/** Whether the site's motion follows the device (`auto`: the `prefers-reduced-motion` setting of its system), is always reduced, or never is. */
export const REDUCE_MOTION_CHOICES = ["auto", "always", "never"] as const

export type ReduceMotion = (typeof REDUCE_MOTION_CHOICES)[number]

/** The keys of the preferences, by name. A switch holds a boolean, a choice one of its few words; a value that is not one (the member can write their own `user_metadata`) reads as the default. */
export const PREFERENCE_KEYS = {
  /** A browser notification when a game waits for them (PLT-24). */
  notifyTurn: "pbgo_notify_turn",
  /** A browser notification when a friend invites them to a table (PLT-24). */
  notifyInvites: "pbgo_notify_invites",
  /** Their game history is hidden from the other players: it is public by default (PLT-16). */
  hideHistory: "pbgo_hide_history",
  /** How the times on their pages are written: 12-hour, 24-hour, or as the page's language does. */
  timeFormat: "pbgo_time_format",
  /** Whether the site's animations are reduced, whatever their device says. */
  reduceMotion: "pbgo_reduce_motion",
} as const

export type PreferenceName = keyof typeof PREFERENCE_KEYS

export type Preferences = {
  notifyTurn: boolean
  notifyInvites: boolean
  hideHistory: boolean
  timeFormat: TimeFormat
  reduceMotion: ReduceMotion
}

/** The preferences that are a switch: what a `PreferenceRow` holds. */
export type SwitchPreferenceName = { [Name in PreferenceName]: Preferences[Name] extends boolean ? Name : never }[PreferenceName]

/** What a preference is until the member sets it. */
export const DEFAULT_PREFERENCES: Preferences = { notifyTurn: true, notifyInvites: true, hideHistory: false, timeFormat: "auto", reduceMotion: "auto" }

/** The `hourCycle` option of an `Intl.DateTimeFormat` that a choice sets: the clock of 12 hours or of 24, and nothing for Automatic, which leaves it to the language the formatter writes in. */
export function hourCycleOf(format: TimeFormat): "h12" | "h23" | undefined {
  return format === "12h" ? "h12" : format === "24h" ? "h23" : undefined
}

/** Whether a value is a way of writing the time (the key holds anything the member wrote, a cookie or a form too). */
export const isTimeFormat = (value: unknown): value is TimeFormat => typeof value === "string" && (TIME_FORMATS as readonly string[]).includes(value)

/** Whether a value is one of the three choices for the site's motion. */
export const isReduceMotion = (value: unknown): value is ReduceMotion => typeof value === "string" && (REDUCE_MOTION_CHOICES as readonly string[]).includes(value)

/** The part of an account that holds the free object `user_metadata`: a user of Supabase Auth, or what the tests make of one. */
type WithMetadata = { user_metadata?: Record<string, unknown> | null }

/** The preferences of a user: each as they set it, else its default. Anything that is not what the preference holds (a boolean, one of its words) is no choice. */
export function preferencesOf(user: WithMetadata): Preferences {
  const claims = user.user_metadata ?? {}
  const flag = (name: SwitchPreferenceName): boolean => {
    const value = claims[PREFERENCE_KEYS[name]]
    return typeof value === "boolean" ? value : DEFAULT_PREFERENCES[name]
  }
  const timeFormat = claims[PREFERENCE_KEYS.timeFormat]
  const reduceMotion = claims[PREFERENCE_KEYS.reduceMotion]
  return {
    notifyTurn: flag("notifyTurn"),
    notifyInvites: flag("notifyInvites"),
    hideHistory: flag("hideHistory"),
    timeFormat: isTimeFormat(timeFormat) ? timeFormat : DEFAULT_PREFERENCES.timeFormat,
    reduceMotion: isReduceMotion(reduceMotion) ? reduceMotion : DEFAULT_PREFERENCES.reduceMotion,
  }
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
