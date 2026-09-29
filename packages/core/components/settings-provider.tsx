"use client"

import { createContext, useContext } from "react"
import { DEFAULT_SETTINGS, type SiteSettings } from "../lib/settings"

const SettingsContext = createContext<SiteSettings>(DEFAULT_SETTINGS)

export function SettingsProvider({ settings, children }: { settings: SiteSettings; children: React.ReactNode }) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

export function useSiteSettings() {
  return useContext(SettingsContext)
}
