import "server-only"
import { randomUUID } from "node:crypto"
import { ANALYTICS_ENABLED, errorCodeOf, type GameRoute, type ServerEvents } from "@pbgo/analytics"
import { track } from "@pbgo/analytics/server"
import { after } from "next/server"
import type { GameRow } from "./games"

/**
 * Sends a game event from the server once the response has left (`after`), so statistics never slow a request down. Call it
 * after the write the event describes, never from the modifier of `updateGame`, which runs again when it loses a race.
 *
 * - `distinctId` is the player's id of this game: a hash of the secret in their `<slug>_player` cookie (`player-id.ts`), never the
 *   secret itself. Nothing more is stored on their device for it, and the events carry no name, no chat text and no table code.
 *   Without a player, nothing is sent.
 * - Never throws: a callback that cannot be scheduled is logged and the game goes on. Without a PostHog configuration `track`
 *   does nothing.
 */
export function trackAfter<E extends keyof ServerEvents>(event: E, distinctId: string | null, properties: ServerEvents[E]): void {
  if (!distinctId) return
  try {
    after(() => track(event, distinctId, properties))
  } catch (error) {
    console.error(`[analytics] could not schedule ${event}`, error instanceof Error ? error.message : error)
  }
}

/**
 * Sends an event that no player carries (a sign-in, a table that went, feedback): its identifier is made for it and used once, so nothing in PostHog ties it to another event, a device or a person. Same rules as `trackAfter`: it
 * leaves once the response has, and it never throws.
 */
export function trackAnonymously<E extends keyof ServerEvents>(event: E, properties: ServerEvents[E]): void {
  trackAfter(event, randomUUID(), properties)
}

/** The routes a request is told apart by, apart from creating a table, reading one and the feedback; the others are the ones a game adds. */
const NAMED_ROUTES: readonly GameRoute[] = ["join", "leave", "action", "chat", "options", "ready", "replay", "settings", "start", "takeover"]

/**
 * Which game route a request is for, from its address: `/api/<game>/games` (`create`), `/api/<game>/games/<code>` (`read`), `/api/<game>/games/<code>/<route>` and `/api/<game>/feedback`. Null for any other address. Only the name of the route is taken, never the code of the table.
 */
export function gameRouteOf(url: string): GameRoute | null {
  let segments: string[]
  try {
    segments = new URL(url).pathname.split("/").filter(Boolean)
  } catch {
    return null
  }
  if (segments[0] !== "api" || segments.length < 3) return null
  if (segments[2] === "feedback") return segments.length === 3 ? "feedback" : null
  if (segments[2] !== "games") return null
  if (segments.length === 3) return "create"
  if (segments.length === 4) return "read"
  if (segments.length !== 5) return null
  return NAMED_ROUTES.find((route) => route === segments[4]) ?? "other"
}

/** The codes of requests that no player really made, or that are noise: a table that is not there, a player who is not known, a body that is not one, the rate limit. They are bots and stale tabs, not what the event is for. */
const QUIET_CODES: ReadonlySet<string> = new Set(["TOO_MANY_REQUESTS", "GAME_NOT_FOUND", "UNKNOWN_PLAYER", "INVALID_REQUEST", "FORBIDDEN", "CROSS_ORIGIN"])

/** No more than this many refusals leave a server instance in a minute, so that a flood of bad requests cannot fill the plan with errors. */
export const REFUSALS_PER_MINUTE = 6

const refusals = { minute: -1, count: 0 }

function underTheCap(now: number): boolean {
  const minute = Math.floor(now / 60_000)
  if (refusals.minute !== minute) {
    refusals.minute = minute
    refusals.count = 0
  }
  refusals.count += 1
  return refusals.count <= REFUSALS_PER_MINUTE
}

/**
 * Tells PostHog that a game route refused a request or failed (`game_route_error`): which route, the error code and the HTTP status, never what was sent. `args` are the arguments the route was called with (the request and the game it is for): a route that
 * is not a game's says nothing. Called by `handle`, for every error it answers. Never throws.
 */
export function reportRefusal(args: readonly unknown[], code: string, status: number, { enabled = ANALYTICS_ENABLED, now = Date.now() }: { enabled?: boolean; now?: number } = {}): void {
  if (!enabled || QUIET_CODES.has(code)) return
  try {
    const [request, context] = args
    if (!(request instanceof Request)) return
    const slug = (context as { game?: { slug?: unknown } } | null | undefined)?.game?.slug
    const route = gameRouteOf(request.url)
    if (typeof slug !== "string" || route === null || !underTheCap(now)) return
    trackAnonymously("game_route_error", { game: slug, route, code: errorCodeOf(code), status })
  } catch (error) {
    console.error("[analytics] could not report a refusal", error instanceof Error ? error.message : error)
  }
}

/**
 * What `game_finished` says about a table that has just reached `over`. Both numbers are approximations, flagged as such: a table
 * stores no start date and no move counter, so the duration is the time since the table was created (`created_at` survives the
 * rematches, so it also counts the lobby and the earlier rounds) and the moves are `version`, which every write bumps (joins,
 * options and votes too). A precise value needs columns. The duration is left out when the row has no usable dates.
 */
export function gameFinishedProperties(
  slug: string,
  row: Pick<GameRow, "players" | "version" | "created_at" | "updated_at">,
): ServerEvents["game_finished"] {
  const seconds = Math.round((Date.parse(row.updated_at ?? "") - Date.parse(row.created_at ?? "")) / 1000)
  return {
    game: slug,
    ...(Number.isFinite(seconds) && seconds >= 0 ? { duration_s: seconds } : {}),
    players: row.players.length,
    moves_count: row.version,
    ended_by: "natural",
    approximate: true,
  }
}

/** `game_finished` for the player whose request ended the game (a move, or a takeover that played the last turn). */
export function trackGameFinished(slug: string, row: Parameters<typeof gameFinishedProperties>[1], distinctId: string | null): void {
  trackAfter("game_finished", distinctId, gameFinishedProperties(slug, row))
}
