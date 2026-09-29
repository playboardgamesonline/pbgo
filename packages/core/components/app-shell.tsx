"use client"

import type { SiteSettings } from "../lib/settings"
import type { Skin } from "../lib/skin"
import { DesktopOnly } from "./desktop-only"
import { SettingsProvider } from "./settings-provider"
import { SkinProvider } from "./skin-provider"
import { SoundEngine } from "./sound/sound"

/** Contexte commun de toutes les pages d'un jeu : réglages, habillage, son, écran « ordinateur uniquement ». */
export function AppShell({ settings, skin, children }: { settings: SiteSettings; skin: Skin; children: React.ReactNode }) {
  return (
    <SettingsProvider settings={settings}>
      <SkinProvider skin={skin}>
        {children}
        <SoundEngine />
        <DesktopOnly />
      </SkinProvider>
    </SettingsProvider>
  )
}
