"use client"

import { createContext, useContext, type ReactNode } from "react"
import { createApi, type GameApi } from "./api"
import type { ClientBinding } from "./binding"

const BindingContext = createContext<ClientBinding | null>(null)

/**
 * Gives core's client components the game shown (constants, engine, logo, board). Rendered by the game's runtime
 * (`@pbgo-game/<slug>/runtime`), which `GameRuntime` of `@pbgo/games` loads for the `[game]` segment.
 * `binding` must be a module-level object: core caches values per binding (default settings…).
 */
export function BindingProvider({ binding, children }: { binding: ClientBinding; children: ReactNode }) {
  return <BindingContext.Provider value={binding}>{children}</BindingContext.Provider>
}

export function useBinding(): ClientBinding {
  const binding = useContext(BindingContext)
  if (!binding) throw new Error("useBinding() needs a BindingProvider above it (rendered by the game's runtime)")
  return binding
}

/** The binding above, or null outside a game's runtime (the hub, the gamemaster, the specimens of the design docs). */
export const useOptionalBinding = () => useContext(BindingContext)

/** Whether a game's runtime is mounted above: false under `/<slug>/...` for a slug that is not a game (its 404). */
export const useHasBinding = () => useOptionalBinding() !== null

export const useGameSlug = () => useBinding().SLUG

const ApiOverrideContext = createContext<GameApi | null>(null)

/** Puts another client in the place of the game's API for everything below: the preview of a game in play answers the board's calls with its made-up table (`SandboxClient`), so that the board and the screen around it play as they do at a real one */
export function ApiOverrideProvider({ api, children }: { api: GameApi; children: ReactNode }) {
  return <ApiOverrideContext.Provider value={api}>{children}</ApiOverrideContext.Provider>
}

/** API client of the game shown (`/api/<slug>/...`), or the one an `ApiOverrideProvider` above puts in its place. */
export const useApi = (): GameApi => {
  const api = createApi(useGameSlug())
  return useContext(ApiOverrideContext) ?? api
}
