import type { LANGUAGES } from "@pbgo/studio-kit/constants"

/** `fr` | `en` | `es` | `de`: derived from the single source of the languages. */
export type Locale = (typeof LANGUAGES)[number]["id"]

/**
 * Events sent by the server, from the API routes, after the write they describe. snake_case, one property `game` = the slug
 * on each. No name, no chat text, no table code: nothing a player typed. One event per action, never one per move
 * (the free tier is 1M events a month): the move count travels on `game_finished`.
 */
export type ServerEvents = {
  game_created: { game: string; options: Record<string, unknown>; max_players: number; locale: Locale }
  /** `seat` is 0-based, `players` counts the table after the join. */
  player_joined: { game: string; seat: number; players: number }
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
  language_changed: { from: Locale; to: Locale }
  cookie_consent: { choice: "accepted" | "refused" }
}
