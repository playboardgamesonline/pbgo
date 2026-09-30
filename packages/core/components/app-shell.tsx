"use client"

import type { SiteSettings } from "../lib/settings"
import type { Skin } from "../lib/skin"
import { configureSounds, type SoundConfig } from "../lib/sound"
import { DesktopOnly } from "./desktop-only"
import { usePreviewDraft } from "./preview-bridge"
import { SettingsProvider } from "./settings-provider"
import { SkinProvider } from "./skin-provider"
import { SoundEngine } from "./sound/sound"

/** Contexte commun de toutes les pages d'un jeu : réglages, habillage, son, écran « ordinateur uniquement ». */
export function AppShell({ settings, skin, sounds, children }: { settings: SiteSettings; skin: Skin; sounds?: SoundConfig; children: React.ReactNode }) {
  if (sounds) configureSounds(sounds)
  const draft = usePreviewDraft()
  return (
    <SettingsProvider settings={draft?.settings ?? settings}>
      <SkinProvider skin={draft?.skin ?? skin}>
        {children}
        <SoundEngine />
        <DesktopOnly />
      </SkinProvider>
    </SettingsProvider>
  )
}
