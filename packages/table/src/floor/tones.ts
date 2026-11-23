"use client"

import { useOptionalSiteSettings } from "@pbgo/core/components/settings-provider"
import { useOptionalBinding } from "@pbgo/core/lib/binding-context"
import type { UiTheme } from "@pbgo/core/lib/binding"
import type { ThemeColors } from "@pbgo/core/lib/settings"
import { buttonTheme } from "@pbgo/core/lib/ui-theme"
import { useMemo } from "react"
import { bloomColor, FALLBACK_COLORS } from "../card/theme"

/** The two tones of a button on the table: the action that goes on (Hit, Deal, Play) and the quieter ones (Stay, Keep, Swap). The game's theme gives each its colour */
export type FloorTone = "primary" | "neutral"

/** `#rrggbb` for each tone, from the game's `UI_THEME.button` over the defaults and the colours of its theme. Pure: the hook below reads the game */
export function floorTones(button: UiTheme["button"], colors: ThemeColors): Record<FloorTone, string> {
  const theme = buttonTheme(button)
  return { primary: bloomColor(theme.primary, colors), neutral: bloomColor(theme.neutral, colors) }
}

/** The tones of the game shown (`UI_THEME.button` of its binding, in the colours of its settings, which the gamemaster can change); the platform's own outside a game's runtime */
export function useFloorTones(): Record<FloorTone, string> {
  const button = useOptionalBinding()?.UI_THEME?.button
  const colors = useOptionalSiteSettings()?.theme ?? FALLBACK_COLORS
  return useMemo(() => floorTones(button, colors), [button, colors])
}

/** The colour a `tone` prop stands for: a tone's own, and the primary for none */
export function toneColour(tone: FloorTone | undefined, tones: Record<FloorTone, string>): string {
  return tones[tone ?? "primary"]
}
