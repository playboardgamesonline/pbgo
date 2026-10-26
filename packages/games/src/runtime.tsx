"use client"

import dynamic from "next/dynamic"
import type { ComponentType, ReactNode } from "react"
import type { GameSlug } from "./registry"

type Runtime = ComponentType<{ children: ReactNode }>

/**
 * Client side of each game (`@pbgo-game/<slug>/runtime`: styles, fonts, binding), one chunk per game: a page loads
 * only the game of its `[game]` segment, and the hub none.
 */
const RUNTIMES: Record<GameSlug, Runtime> = {
  courtisans: dynamic(() => import("@pbgo-game/courtisans/runtime")),
  template: dynamic(() => import("@pbgo-game/template/runtime")),
  "6-nimmt": dynamic(() => import("@pbgo-game/6-nimmt/runtime")),
  "7-wonders": dynamic(() => import("@pbgo-game/7-wonders/runtime")),
  "cry-baby": dynamic(() => import("@pbgo-game/cry-baby/runtime")),
  "dracula-vs-van-helsing": dynamic(() => import("@pbgo-game/dracula-vs-van-helsing/runtime")),
  "exploding-kittens": dynamic(() => import("@pbgo-game/exploding-kittens/runtime")),
  "flip-7": dynamic(() => import("@pbgo-game/flip-7/runtime")),
  hanabi: dynamic(() => import("@pbgo-game/hanabi/runtime")),
  "love-letter": dynamic(() => import("@pbgo-game/love-letter/runtime")),
  odin: dynamic(() => import("@pbgo-game/odin/runtime")),
  omens: dynamic(() => import("@pbgo-game/omens/runtime")),
  "skull-king": dynamic(() => import("@pbgo-game/skull-king/runtime")),
  "sky-team": dynamic(() => import("@pbgo-game/sky-team/runtime")),
  skyjo: dynamic(() => import("@pbgo-game/skyjo/runtime")),
  "time-bomb": dynamic(() => import("@pbgo-game/time-bomb/runtime")),
  trio: dynamic(() => import("@pbgo-game/trio/runtime")),
  "welcome-to": dynamic(() => import("@pbgo-game/welcome-to/runtime")),
}

/** Wraps the pages of a game with its runtime. The `[game]` layout has already answered 404 for unknown slugs. */
export function GameRuntime({ slug, children }: { slug: string; children: ReactNode }) {
  const Runtime = RUNTIMES[slug as GameSlug]
  if (!Runtime) throw new Error(`No runtime for the game "${slug}" in @pbgo/games`)
  return <Runtime>{children}</Runtime>
}
