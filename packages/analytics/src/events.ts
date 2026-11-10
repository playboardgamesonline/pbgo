import type { LANGUAGES, PLATFORM_LANGUAGES } from "@pbgo/studio-kit/constants"
import type { ErrorCode } from "./error-code"

/** `fr` | `en` | `es` | `de`: derived from the single source of the languages. */
export type Locale = (typeof LANGUAGES)[number]["id"]

/** Any language a visitor can choose (the platform's thirteen, the four above among them): the hub's own language picker reports one of them. */
export type Language = (typeof PLATFORM_LANGUAGES)[number]["id"]

/** The providers that sign somebody in. */
export type AuthProvider = "google" | "discord" | "steam"

/** How somebody signs in or up: an e-mail address and a password, the code or the link of the sign-up's e-mail, or a provider. */
export type SignInMethod = "password" | "email_code" | "email_link" | AuthProvider

/** What a member changed on their account. Never the new value, and never an address. */
export type AccountChange = "email" | "password" | "mfa_enabled" | "mfa_disabled" | "provider_link_started" | "provider_unlinked" | "other_devices_signed_out"

/** A service that can be linked to an account: the providers above, and Twitch, which signs nobody in. */
export type AccountService = AuthProvider | "twitch"

/** The settings of a member whose change is counted (the key only). The language, the username and the history have events of their own. */
export type SettingKey = "country" | "birthdate" | "time_format" | "reduce_motion" | "reduce_transparency"

/** What the host of a table can set: who may join it (`visibility`, and the rank and the language a public table asks), how fast it is played and how many seats it has. */
export type TableSettingKey = "visibility" | "min_rank" | "language" | "pace" | "seats"

/** Who may find a table: a public one is listed, a private one is reached by its link. */
export type TableVisibility = "public" | "private"

/** Where a list of tables is drawn. */
export type TableListSource = "game_page" | "tables_tab" | "home"

/** The lists a visitor can search: the games of the home and of `/games`, and the tables of `/tables`. */
export type SearchedList = "home" | "games" | "tables"

/** The order of the games' list. */
export type GameOrder = "trending" | "name" | "newest"

/** The game routes that can refuse a request: the table's own, the feedback, and the routes a game adds (`other`). */
export type GameRoute = "create" | "read" | "join" | "leave" | "action" | "chat" | "options" | "ready" | "replay" | "settings" | "start" | "takeover" | "feedback" | "other"

/**
 * Events sent by the server, from the API routes, after the write they describe. snake_case, one property `game` = the slug
 * on each. No name, no chat text, no table code: nothing a player typed. One event per action, never one per move
 * (the free tier is 1M events a month): the move count travels on `game_finished`.
 */
export type ServerEvents = {
  game_created: { game: string; options: Record<string, unknown>; max_players: number; locale: Locale }
  /** `seat` is 0-based, `players` counts the table after the join. */
  player_joined: { game: string; seat: number; players: number }
  /** The game begins: the last player has said they are ready (PLT-107; before it, the host's start). Sent for the host, whoever was the last. */
  game_started: { game: string; players: number; options: Record<string, unknown> }
  /**
   * `duration_s` and `moves_count` are approximations: a table has no start date and no move counter, so they come from the
   * row (`updated_at - created_at` and `version`, which every write bumps: joins, options, votes too). `approximate` says so.
   * A precise value needs a column. Absent when the row has no dates.
   */
  game_finished: {
    game: string
    duration_s?: number
    players: number
    moves_count: number
    ended_by: "natural"
    approximate: true
  }
  /** A player left a table that had begun, from its ready check or from a game in progress (PLT-120); a lobby that is left is no event. */
  game_left: { game: string; phase: "starting" | "playing" }
  /**
   * A table that nobody sits at any more went at once (PLT-21), and `reason` says how it came to be empty: the last player left the lobby, its ready check or the game, or a ready check ran out of time with nobody ready.
   * No person is behind it: it is sent with an identifier that is used once.
   */
  table_deleted: { game: string; reason: "lobby_left" | "ready_check_left" | "game_left" | "nobody_ready" }
  /** Somebody sent feedback: the game, its type and whether it came with a screenshot and an address. Never the text, the address or the name. No person is behind it. */
  feedback_sent: { game: string; type: "review" | "bug" | "suggestion" | "other"; with_screenshot: boolean; with_email: boolean }
  /**
   * A request to a game route was refused or failed: which route, the error code and the HTTP status. Never what was sent. Not the rate limit, nor the codes of a request that no player made (an unknown table, an unknown player): those are bots and
   * stale tabs. A few a minute at most, per server instance. No person is behind it.
   */
  game_route_error: { game: string; route: GameRoute; code: ErrorCode; status: number }
  /** Somebody signed in with a provider or with the link of the sign-up's e-mail (the browser reports the others: `ClientEvents`). `new_account` says that it made the account. No person is behind it. */
  signed_in: { method: AuthProvider | "email_link"; new_account: boolean }
  /** Somebody signed out. No person is behind it. */
  signed_out: Record<string, never>
  /** An account was closed on its member's word (`requested`), reopened with the link of the e-mail (`reopened`) or deleted at once (`deleted_now`), or deleted by the nightly clean-up when its days were over (`purged`). No person is behind it. */
  account_deletion: { step: "requested" | "reopened" | "deleted_now" | "purged" }
  rematch_started: { game: string }
  takeover_vote_started: { game: string }
  takeover_completed: { game: string }
  turn_auto_played: { game: string; reason: "takeover" }
  /** Never the text, never the reaction. */
  chat_message_sent: { game: string; kind: "text" | "reaction" }
  /** A visitor pressed Play: the slugs of the games they look for and how the table counts. */
  quick_play_started: { mode: "normal" | "ranked"; games: string[] }
  /** A search found its table, which has begun: `how` says whether the visitor sat at a lobby that was open or opened it, `wait_s` how long they waited. */
  quick_play_matched: { game: string; mode: "normal" | "ranked"; how: "joined" | "opened"; wait_s: number; players: number }
  /** A visitor stopped looking: the slugs of the games they looked for, and how long they had waited when it is known. */
  quick_play_cancelled: { mode: "normal" | "ranked"; games: string[]; wait_s?: number }
}

/** Events sent by the browser, on top of the pageviews, clicks, web vitals and exceptions PostHog captures by itself. */
export type ClientEvents = {
  game_opened_from_hub: { game: string }
  invite_link_copied: { game: string }
  rules_opened: { game: string }
  /** The sign-in or the sign-up was started: the form was sent, or the visitor left for a provider. */
  auth_started: { flow: "signin" | "signup"; method: "password" | AuthProvider }
  /** The sign-up form was accepted and the card turned to the code of the e-mail (`resent`: a new code was asked for). An address that already has an account goes through the same step. */
  signup_code_sent: { resent: boolean }
  /** Somebody signed in with an e-mail address and a password, or with the code of the sign-up's e-mail (the server reports the others: `ServerEvents`). */
  signed_in: { method: "password" | "email_code"; new_account: boolean }
  /** A member changed something on their account, once it was kept. `service` is the one it was done for, when it was a service. */
  account_changed: { change: AccountChange; service?: AccountService }
  /** A member changed one of their settings, once it was kept: which one, never to what. */
  setting_changed: { setting: SettingKey }
  /** The host of a table changed a setting of it, once it was kept; `visibility` is who may join it now. */
  table_setting_changed: { game: string; setting: TableSettingKey; visibility: TableVisibility }
  /** A visitor picked a table of a list of the tables that are open to everyone. */
  public_table_clicked: { game: string; from: TableListSource }
  /**
   * A visitor searched, filtered or sorted a list, and stopped for a second: whether a text was typed, how many filters are on, how many results there are and, for the games, in which order. Never the text typed.
   */
  list_searched: { list: SearchedList; with_text: boolean; filters: number; results: number; sort?: GameOrder }
  /** A button of a game's page. The ones that play have their own events. */
  game_page_clicked: { game: string; target: "create_table" | "buy" }
  language_changed: { from: Language; to: Language }
  cookie_consent: { choice: "accepted" | "refused"; marketing: boolean }
  /**
   * A member's profile was opened (PLT-39): `own` is the visitor's own, `hidden` is that its games are not shown to the visitor (the member keeps them private), and `from` is where the link they followed was drawn (`?from=` of the address: a seat's card,
   * a leaderboard, the games of another profile, the member's own account; `direct` when it says nothing). Never a nickname or a tag: the address of the page is scrubbed too (`scrub.ts`).
   */
  profile_viewed: { own: boolean; hidden: boolean; from: "seat" | "leaderboard" | "history" | "account" | "direct" }
  /** A member changed their nickname, their tag, or both (PLT-39): which of them changed, never what they became. */
  profile_updated: { nickname: boolean; tag: boolean }
  /** A change of the nickname or the tag was refused: somebody else goes by that pair, it is not what a profile can have, or it cannot be saved yet (PLT-39). */
  profile_update_refused: { reason: "taken" | "invalid" | "unavailable" }
  /** A member chose to hide their games from the other players, or to show them again (PLT-39: "Hide my game history" of the privacy settings). */
  profile_history_hidden: { hidden: boolean }
}
