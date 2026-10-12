import "server-only"
import { type GameModule, type GameRouteHandler, isPlayable, type PlayableGame, type ServerBinding } from "@pbgo/core/lib/binding"
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
  timebomb: () => import("@pbgo-game/timebomb/server"),
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

type SegmentParams = Record<string, string | string[] | undefined>

/**
 * Next route handler under `/api/[game]/...`: resolves the game from the segment, 404 `GAME_NOT_FOUND` when it is
 * unknown or not playable here, then calls the `@pbgo/core` handler with the game and the other segments.
 */
export function gameRoute(handler: GameRouteHandler) {
  return async (request: Request, { params }: { params: Promise<SegmentParams> }) => {
    const { game: slug, ...rest } = await params
    const game = typeof slug === "string" ? await getPlayableGame(slug) : null
    if (!game) return Response.json({ error: "GAME_NOT_FOUND" }, { status: 404 })
    const segments: Record<string, string> = {}
    for (const [key, value] of Object.entries(rest)) if (typeof value === "string") segments[key] = value
    return handler(request, { game, params: segments })
  }
}
