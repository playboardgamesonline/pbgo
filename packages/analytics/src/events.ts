import type { LANGUAGES, PLATFORM_LANGUAGES } from "@pbgo/studio-kit/constants"

/** `fr` | `en` | `es` | `de`: derived from the single source of the languages. */
export type Locale = (typeof LANGUAGES)[number]["id"]

/** Any language a visitor can choose (the platform's thirteen, the four above among them): the hub's own language picker reports one of them. */
export type Language = (typeof PLATFORM_LANGUAGES)[number]["id"]

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
  rematch_started: { game: string }
  takeover_vote_started: { game: string }
  takeover_completed: { game: string }
  turn_auto_played: { game: string; reason: "takeover" }
  /** Never the text, never the reaction. */
  chat_message_sent: { game: string; kind: "text" | "reaction" }
}

/** Events sent by the browser, on top of the pageviews, clicks, web vitals and exceptions PostHog captures by itself. */
export type ClientEvents = {
  game_opened_from_hub: { game: string }
  invite_link_copied: { game: string }
  rules_opened: { game: string }
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
