import "server-only"
import {
  type GameModule,
  type GameRouteHandler,
  type GamemasterRouteHandler,
  hasEngine,
  isPlayable,
  type PlayableGame,
  type ServerBinding,
} from "@pbgo/core/lib/binding"
import { findGame, type GameSlug } from "./registry"

export { findGame, GAMES, type GameSlug, listedGames } from "./registry"

/** Server side of each game (`@pbgo-game/<slug>/server`), loaded on the first request for it. */
const LOADERS: Record<GameSlug, () => Promise<ServerBinding>> = {
  courtisans: () => import("@pbgo-game/courtisans/server"),
  template: () => import("@pbgo-game/template/server"),
  "6-nimmt": () => import("@pbgo-game/6-nimmt/server"),
  "7-wonders": () => import("@pbgo-game/7-wonders/server"),
  "cry-baby": () => import("@pbgo-game/cry-baby/server"),
  "dracula-vs-van-helsing": () => import("@pbgo-game/dracula-vs-van-helsing/server"),
  "exploding-kittens": () => import("@pbgo-game/exploding-kittens/server"),
  "flip-7": () => import("@pbgo-game/flip-7/server"),
  hanabi: () => import("@pbgo-game/hanabi/server"),
  "love-letter": () => import("@pbgo-game/love-letter/server"),
  odin: () => import("@pbgo-game/odin/server"),
  omens: () => import("@pbgo-game/omens/server"),
  "skull-king": () => import("@pbgo-game/skull-king/server"),
  "sky-team": () => import("@pbgo-game/sky-team/server"),
  skyjo: () => import("@pbgo-game/skyjo/server"),
  "time-bomb": () => import("@pbgo-game/time-bomb/server"),
  trio: () => import("@pbgo-game/trio/server"),
  "welcome-to": () => import("@pbgo-game/welcome-to/server"),
}

const modules = new Map<string, Promise<GameModule>>()

/** The game of a `[game]` segment (registry entry and server binding), null when the slug is unknown. */
export function getGame(slug: string): Promise<GameModule | null> {
  const entry = findGame(slug)
  if (!entry) return Promise.resolve(null)
  let game = modules.get(entry.slug)
  if (!game) {
    const loading = LOADERS[entry.slug as GameSlug]().then((binding) => ({ ...entry, binding }))
    game = loading
    modules.set(entry.slug, loading)
    // A failed import (a chunk that did not load) is not kept: the next request loads the game again instead of failing until the next deployment
    loading.catch(() => {
      if (modules.get(entry.slug) === loading) modules.delete(entry.slug)
    })
  }
  return game
}

/** The game when it can be played here (engine, and live in production), else null: pages answer 404. */
export async function getPlayableGame(slug: string): Promise<PlayableGame | null> {
  const game = await getGame(slug)
  return game && isPlayable(game) ? game : null
}

/**
 * The game when it has an engine, live or not: for the admin previews, so the gamemaster can set up a game that is not live
 * yet in production too. Anyone can ask for these URLs, so the page itself answers 404 without the admin session.
 */
export async function getPreviewableGame(slug: string): Promise<PlayableGame | null> {
  const game = await getGame(slug)
  return game && hasEngine(game) ? game : null
}

type SegmentParams = Record<string, string | string[] | undefined>

/** The string segments of a route, without the `[game]` one. */
function segmentsOf(rest: SegmentParams) {
  const segments: Record<string, string> = {}
  for (const [key, value] of Object.entries(rest)) if (typeof value === "string") segments[key] = value
  return segments
}

/**
 * Next route handler under `/api/[game]/...`: resolves the game from the segment, 404 `GAME_NOT_FOUND` when it is
 * unknown or not playable here, then calls the `@pbgo/core` handler with the game and the other segments.
 */
export function gameRoute(handler: GameRouteHandler) {
  return async (request: Request, { params }: { params: Promise<SegmentParams> }) => {
    const { game: slug, ...rest } = await params
    const game = typeof slug === "string" ? await getPlayableGame(slug) : null
    if (!game) return Response.json({ error: "GAME_NOT_FOUND" }, { status: 404 })
    return handler(request, { game, params: segmentsOf(rest) })
  }
}

/**
 * Next route handler under `/gamemaster/api/[game]/...`: any game of the registry (the gamemaster also manages the ones
 * that are not live yet, in production too), 404 `GAME_NOT_FOUND` for an unknown slug. Handlers check the session themselves.
 */
export function gamemasterRoute(handler: GamemasterRouteHandler) {
  return async (request: Request, { params }: { params: Promise<SegmentParams> }) => {
    const { game: slug, ...rest } = await params
    const game = typeof slug === "string" ? await getGame(slug) : null
    if (!game) return Response.json({ error: "GAME_NOT_FOUND" }, { status: 404 })
    return handler(request, { game, params: segmentsOf(rest) })
  }
}
