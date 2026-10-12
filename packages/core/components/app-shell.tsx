"use client"

import { useGameSlug } from "../lib/binding-context"
import type { SiteSettings } from "../lib/settings"
import type { Skin } from "../lib/skin"
import { configureSounds, NO_SOUNDS, type SoundConfig } from "../lib/sound"
import { DesktopOnly } from "./desktop-only"
import { usePreviewDraft } from "./preview-bridge"
import { SettingsProvider } from "./settings-provider"
import { SkinProvider } from "./skin-provider"
import { SoundEngine, SoundsProvider } from "./sound/sound"

/** Shared context of every page of a game: settings, skin, sound, "computer only" screen (game pages). */
export function AppShell({ settings, skin, sounds, children }: { settings: SiteSettings; skin: Skin; sounds?: SoundConfig; children: React.ReactNode }) {
  const slug = useGameSlug()
  // During render, not in an effect: children's effects run first and may already play a sound. Client only: the server renders every game.
  if (sounds && typeof window !== "undefined") configureSounds(slug, sounds)
  const draft = usePreviewDraft()
  return (
    <SettingsProvider settings={draft?.settings ?? settings}>
      <SkinProvider skin={draft?.skin ?? skin}>
        <SoundsProvider value={sounds ?? NO_SOUNDS}>
          {children}
          <SoundEngine />
          <DesktopOnly />
        </SoundsProvider>
      </SkinProvider>
    </SettingsProvider>
  )
}
