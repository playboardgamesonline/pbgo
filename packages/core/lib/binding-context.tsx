"use client"

import { createContext, useContext, type ReactNode } from "react"
import { configureErrors, createApi, type GameApi } from "./api"
import type { ClientBinding } from "./binding"

const BindingContext = createContext<ClientBinding | null>(null)

/**
 * Gives core's client components the game shown (constants, engine, logo, board). Rendered by the game's runtime
 * (`@pbgo-game/<slug>/runtime`), which `GameRuntime` of `@pbgo/games` loads for the `[game]` segment.
 * `binding` must be a module-level object: core caches values per binding (default settings, error messages…).
 */
export function BindingProvider({ binding, children }: { binding: ClientBinding; children: ReactNode }) {
  // A page shows one game: the messages of its client errors follow it (client only: the server renders every game).
  if (typeof window !== "undefined") configureErrors(binding)
  return <BindingContext.Provider value={binding}>{children}</BindingContext.Provider>
}

export function useBinding(): ClientBinding {
  const binding = useContext(BindingContext)
  if (!binding) throw new Error("useBinding() needs a BindingProvider above it (rendered by the game's runtime)")
  return binding
}

export const useGameSlug = () => useBinding().SLUG

/** API client of the game shown (`/api/<slug>/...`). */
export const useApi = (): GameApi => createApi(useGameSlug())
