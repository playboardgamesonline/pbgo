"use client"

import { createContext, useContext } from "react"
import { useBinding, useOptionalBinding } from "../lib/binding-context"
import { defaultSettings, type SiteSettings } from "../lib/settings"

const SettingsContext = createContext<SiteSettings | null>(null)

export function SettingsProvider({ settings, children }: { settings: SiteSettings; children: React.ReactNode }) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

/** Settings of the game shown (admin, then its defaults outside `AppShell`). */
export function useSiteSettings() {
  const settings = useContext(SettingsContext)
  const binding = useBinding()
  return settings ?? defaultSettings(binding)
}

/** The same, or null outside a game's runtime (the specimens of the design docs and the playground, which have no game): for what has a default of its own to fall back on. */
export function useOptionalSiteSettings() {
  const settings = useContext(SettingsContext)
  const binding = useOptionalBinding()
  return settings ?? (binding ? defaultSettings(binding) : null)
}
