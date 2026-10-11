"use client"

import { createContext, useContext } from "react"
import { useBinding } from "../lib/binding-context"
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
